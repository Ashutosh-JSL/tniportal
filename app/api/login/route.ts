import { NextResponse } from "next/server";
import * as sql from "mssql";
import crypto from "crypto";
import { getConnection } from "@/lib/dbConnect";

export async function POST(req: Request) {
  try {
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
          ON er.UserID = e.Employee_Code
        LEFT JOIN dbo.Role_Master r
          ON r.Role_ID = er.Role_ID
        WHERE (e.Employee_Code = @login OR e.E_MAIL = @login)
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