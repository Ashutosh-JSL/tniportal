
import { decrypt } from "@/lib/aesEncryption";
import { NextRequest, NextResponse } from "next/server";
import * as sql from "mssql";
import { getConnection } from "@/lib/dbConnect";

const verifyUrl = "https://jslaisrv01.jindalstainless.com/api/profile";

export async function GET(request: NextRequest) {
    try {
        let apiEmail = "";

        // 1. First check from the profile URL
        try {
            const fetchHeaders = new Headers();
            const cookieHeader = request.headers.get("cookie");

            // console.log("--- Debug SSO Route ---");
            // console.log("Incoming request URL:", request.url);
            // console.log("Cookie header present:", !!cookieHeader);

            if (cookieHeader) {
                fetchHeaders.set("cookie", cookieHeader);
            }

            const profileRes = await fetch(verifyUrl, {
                headers: fetchHeaders,
            });

            console.log("Profile API Status:", profileRes.status);

            if (profileRes.ok) {
                const data = await profileRes.json();
                console.log("Profile API returned data:", data);
                apiEmail = data?.Email || "";
            } else {
                const text = await profileRes.text();
                console.log("Profile API error response:", text);
            }
        } catch (err) {
            console.error("Error fetching verifyUrl profile:", err);
        }

        // 2. If email found from profile URL, look up user in DB and return
        if (apiEmail) {
            const pool = await getConnection();
            const result = await pool
                .request()
                .input("email", sql.VarChar, apiEmail)
                .query(`
                    SELECT
                        e.Employee_Code,
                        e.Employee_Name,
                        e.E_MAIL,
                        r.Role_Desc
                    FROM [Employee_DB].[dbo].[Employee_Master] e
                    LEFT JOIN dbo.Role_Auth er
                        ON er.UserID = e.Employee_Code COLLATE DATABASE_DEFAULT
                    LEFT JOIN dbo.Role_Master r
                        ON r.Role_ID = er.Role_ID
                    WHERE e.E_MAIL COLLATE DATABASE_DEFAULT = @email
                        AND e.Status = 1
                `);

            if (result.recordset.length > 0) {
                const user = result.recordset[0];
                const roles = result.recordset
                    .map((r: any) => r.Role_Desc)
                    .filter(Boolean);
                const uniqueRoles = [...new Set(roles)];
                const activeRole =
                    uniqueRoles.length > 0 ? uniqueRoles[0] : null;

                return NextResponse.json({
                    success: true,
                    message: "User found - auto login",
                    user: {
                        employeeCode: user.Employee_Code,
                        username: user.Employee_Name,
                        email: user.E_MAIL,
                        roles: uniqueRoles,
                        activeRole: activeRole,
                    },
                });
            } else {
                // User not found — fall through to QS fallback
                console.log("Email from profile API not found in DB, trying QS fallback");
            }
        }

        // 3. Fallback to QS (QueryString) parameter from the current URL
        const currentUrl = new URL(request.url);
        const queryString = currentUrl.searchParams.get("QS");

        if (!queryString) {
            return NextResponse.json(
                {
                    error: "Email not found. No QS parameter provided.",
                    showManualLogin: true,
                },
                { status: 400 }
            );
        }

        // The SSO URL contains literal '+' signs but encodes '/' as '%2F' and '=' as '%3D'.
        // We must use decodeURIComponent to safely decode without turning '+' into spaces.
        const decodedQS = decodeURIComponent(queryString);

        // Decrypt the QS
        const decryptedQueryString = decrypt(decodedQS);

        // Extract email (assuming format like "userEmail=...,userID=...")
        const userEmailQS = decryptedQueryString.split(",")[0];
        const extractedEmail = userEmailQS.split("=")[1];

        if (extractedEmail) {
            // Check if user exists in database
            const pool = await getConnection();
            const result = await pool
                .request()
                .input("email", sql.VarChar, extractedEmail)
                .query(`
                    SELECT
                        e.Employee_Code,
                        e.Employee_Name,
                        e.E_MAIL,
                        r.Role_Desc
                    FROM [Employee_DB].[dbo].[Employee_Master] e
                    LEFT JOIN dbo.Role_Auth er
                        ON er.UserID = e.Employee_Code COLLATE DATABASE_DEFAULT
                    LEFT JOIN dbo.Role_Master r
                        ON r.Role_ID = er.Role_ID
                    WHERE e.E_MAIL COLLATE DATABASE_DEFAULT = @email
                        AND e.Status = 1
                `);

            if (result.recordset.length > 0) {
                const user = result.recordset[0];
                const roles = result.recordset
                    .map((r: any) => r.Role_Desc)
                    .filter(Boolean);
                const uniqueRoles = [...new Set(roles)];
                const activeRole =
                    uniqueRoles.length > 0 ? uniqueRoles[0] : null;

                return NextResponse.json({
                    success: true,
                    message: "User found - auto login",
                    user: {
                        employeeCode: user.Employee_Code,
                        username: user.Employee_Name,
                        email: user.E_MAIL,
                        roles: uniqueRoles,
                        activeRole: activeRole,
                    },
                });
            } else {
                // User not found — show manual login form
                return NextResponse.json(
                    {
                        success: false,
                        message: "User not found. Please use manual login.",
                        showManualLogin: true,
                    },
                    { status: 404 }
                );
            }
        }

        return NextResponse.json(
            {
                error: "Unable to retrieve email from SSO",
                showManualLogin: true,
            },
            { status: 400 }
        );
    } catch (error) {
        console.error("Error processing SSO:", error);
        return NextResponse.json(
            {
                error: "Failed to process authentication",
                showManualLogin: true,
            },
            { status: 500 }
        );
    }
}
