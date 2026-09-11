import { NextResponse } from "next/server";
import * as sql from "mssql";
import crypto from "crypto";
import { getConnection } from "@/lib/dbConnect";
import { decrypt } from "@/lib/aesEncryption";
import { encode as encodeJWT } from "next-auth/jwt";

const verifyUrl = "https://jslaisrv01.jindalstainless.com/api/profile";

// Chunk size for session cookie (next-auth 4: 4096 - 163 = 3933)
const CHUNK_SIZE = 3933;

function getSecret(): string | undefined {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
}

// Determine if we should use __Secure- prefix (secure URL) or regular
function isSecureContext(): boolean {
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (!nextAuthUrl) return false;
  return !nextAuthUrl.startsWith("http://");
}

export async function POST(req: Request) {
  try {
    // First, check if this is an SSO request (with QS parameter)
    const url = new URL(req.url);
    const qsParam = url.searchParams.get("QS");

    if (qsParam) {
      // SSO login flow
      let email = "";

      try {
        // Try to get email from profile URL
        const fetchHeaders = new Headers();
        const cookieHeader = req.headers.get("cookie");

        if (cookieHeader) {
          fetchHeaders.set("cookie", cookieHeader);
        }

        const profileRes = await fetch(verifyUrl, {
          headers: fetchHeaders,
        });

        if (profileRes.ok) {
          const data = await profileRes.json();
          email = data?.Email || "";
        }
      } catch (err) {
        console.error("Error fetching verifyUrl profile:", err);
      }

      // If no email from profile, decrypt QS parameter
      if (!email) {
        try {
          const decodedQS = decodeURIComponent(qsParam);
          const decryptedQueryString = await decrypt(decodedQS);
          const userEmailQS = decryptedQueryString.split(",")[0];
          email = userEmailQS.split("=")[1] || "";
        } catch (error) {
          console.error("Error decrypting QS:", error);
        }
      }

      if (email) {
        // Auto-login for SSO user - fetch user details from DB
        const pool = await getConnection();
        const result = await pool
          .request()
          .input("email", sql.VarChar, email)
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

        if (result.recordset.length === 0) {
          return NextResponse.json(
            { success: false, message: "User not found or inactive" },
            { status: 404 }
          );
        }

        const user = result.recordset[0];
        const roles = result.recordset
          .map((r) => r.Role_Desc)
          .filter(Boolean);
        const uniqueRoles = [...new Set(roles)];

        if (uniqueRoles.length === 0) {
          return NextResponse.json(
            { success: false, message: "No role assigned to this user" },
            { status: 403 }
          );
        }

        const defaultRole = uniqueRoles.includes("Admin")
          ? "Admin"
          : uniqueRoles.includes("Incharge")
            ? "Incharge"
            : uniqueRoles[0];

        // Build the JWT payload exactly as next-auth 4 does (line 380-385 in callback.js)
        const tokenPayload = {
          name: user.Employee_Name,
          email: user.E_MAIL,
          picture: undefined,
          sub: String(user.Employee_Code),
          // Custom fields added by our jwt callback
          role: defaultRole,
          roles: uniqueRoles,
          username: user.Employee_Name,
          employeeCode: String(user.Employee_Code),
        };

        const secret = getSecret();
        if (!secret) {
          console.error("SSO: NEXTAUTH_SECRET not set — cannot create session");
          return NextResponse.json(
            { success: false, message: "Server misconfiguration" },
            { status: 500 }
          );
        }

        // Encrypt the JWT token exactly as next-auth does (line 393)
        const encryptedToken = await encodeJWT({
          token: tokenPayload as any,
          secret,
        });

        // Expiry = session.maxAge (8 hours) from now
        const cookieExpires = new Date(Date.now() + 8 * 60 * 60 * 1000);

        // Determine cookie prefix (__Secure- for secure context, empty otherwise) — matches next-auth core/lib/cookie.js line 18
        const cookiePrefix = isSecureContext() ? "__Secure-" : "";
        const sessionCookieName = `${cookiePrefix}next-auth.session-token`;

        // Chunk the cookie exactly as SessionStore.chunk does (core/lib/cookie.js line 144-167)
        const chunks: { name: string; value: string; expires: Date }[] = [];
        const chunkCount = Math.ceil(encryptedToken.length / CHUNK_SIZE);

        if (chunkCount === 1) {
          chunks.push({ name: sessionCookieName, value: encryptedToken, expires: cookieExpires });
        } else {
          for (let i = 0; i < chunkCount; i++) {
            const chunkValue = encryptedToken.substring(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            chunks.push({ name: `${sessionCookieName}.${i}`, value: chunkValue, expires: cookieExpires });
          }
        }

        // Build Set-Cookie headers for ALL chunks
        const setCookies = chunks.map((c) => {
          const parts = [
            `${c.name}=${c.value}`,
            "Path=/",
            "HttpOnly",
            "SameSite=Lax",
            isSecureContext() ? "Secure" : "",
            `Expires=${cookieExpires.toUTCString()}`,
            `Max-Age=${8 * 3600}`,
          ].filter(Boolean);
          return parts.join("; ");
        });

        // Create response and set ALL session cookies
        const response = NextResponse.json({
          success: true,
          message: "SSO login successful",
          user: {
            employeeCode: user.Employee_Code,
            username: user.Employee_Name,
            email: user.E_MAIL,
            roles: uniqueRoles,
            activeRole: defaultRole,
          },
        });

        // Set each cookie individually (multiple Set-Cookie headers)
        for (const hc of setCookies) {
          response.headers.append("Set-Cookie", hc);
        }

        return response;
      }

      return NextResponse.json(
        { success: false, message: "Unable to retrieve email from SSO" },
        { status: 400 }
      );
    }

    // Standard login flow
    const { email, password } = await req.json();

    /* ================= VALIDATION ================= */
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email/Username and password are required" },
        { status: 400 }
      );
    }

    /* ================= DB CONNECTION ================= */
    const pool = await getConnection();

    /* ================= FETCH USER + ROLES ================= */
    const result = await pool
      .request()
      .input("login", sql.VarChar, email)
      .query(`
        SELECT
          e.Employee_Code,
          e.Employee_Name,
          e.Emp_Pwd,
          e.E_MAIL,
          r.Role_Desc
        FROM [Employee_DB].[dbo].[Employee_Master] e
        LEFT JOIN dbo.Role_Auth er
          ON er.UserID = e.Employee_Code COLLATE DATABASE_DEFAULT
        LEFT JOIN dbo.Role_Master r
          ON r.Role_ID = er.Role_ID
        WHERE (e.Employee_Code COLLATE DATABASE_DEFAULT = @login OR e.E_MAIL COLLATE DATABASE_DEFAULT = @login)
        AND e.Status = 1
 
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid credentials or inactive account" },
        { status: 401 }
      );
    }

    const user = result.recordset[0];

    /* ================= PASSWORD ENCRYPTION (.NET MATCH) ================= */
    const encryptionKey = "MAKV2SPBNI99212";

    const salt = Buffer.from([
      0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d,
      0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76
    ]);

    const clearBytes = Buffer.from(password, "utf16le");

    const derived = crypto.pbkdf2Sync(
      encryptionKey,
      salt,
      1000,
      48,
      "sha1"
    );

    const aesKey = derived.slice(0, 32);
    const iv = derived.slice(32, 48);

    const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(clearBytes),
      cipher.final(),
    ]);

    const encryptedPassword = encrypted.toString("base64");

    /* ================= PASSWORD CHECK ================= */
    if (encryptedPassword !== user.Emp_Pwd) {
      return NextResponse.json(
        { success: false, message: "Invalid credentials" },
        { status: 401 }
      );
    }

    /* ================= COLLECT USER ROLES ================= */
    const roles = result.recordset
      .map((r) => r.Role_Desc)
      .filter(Boolean);

    const uniqueRoles = [...new Set(roles)];

    /* ================= DEFAULT ACTIVE ROLE ================= */
    const activeRole = uniqueRoles.length > 0 ? uniqueRoles[0] : null;

    /* ================= SUCCESS RESPONSE ================= */
    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        employeeCode: user.Employee_Code,
        username: user.Employee_Name,
        email: user.E_MAIL,
        roles: uniqueRoles,
        activeRole: activeRole,
      },
    });

  } catch (error) {
    console.error("Login API Error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}