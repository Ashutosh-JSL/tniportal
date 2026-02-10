import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import * as sql from "mssql";
import { getConnection } from "@/lib/dbConnect"; // adjust path if needed
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email/Username and password are required" },
        { status: 400 }
      );
    }

    // Get DB connection
    const pool = await getConnection();

    // Fetch ACTIVE user by Email or Username
    const result = await pool
      .request()
      .input("login", sql.VarChar, email)
      .query(`
        SELECT 
          UserID,
          UserName,
          Password,
          Status
        FROM Login_Master
        WHERE (UserID = @login OR Username = @login)
          AND Status = 1
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid credentials or inactive account" },
        { status: 401 }
      );
    }

    const user = result.recordset[0];

    const encryptionKey="MAKV2SPBNI99212";
        const salt = Buffer.from([0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76 ]); // "Ivan"
   
      // Match .NET's Encoding.Unicode = UTF-16LE
      const clearBytes = Buffer.from(password, 'utf16le');
   
      // Derive key and IV using PBKDF2 (like Rfc2898DeriveBytes)
      const key = crypto.pbkdf2Sync(encryptionKey, salt, 1000, 32 + 16, 'sha1');
      const aesKey = key.slice(0, 32);
      const iv = key.slice(32, 48);
   
      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
      const encrypted = Buffer.concat([cipher.update(clearBytes), cipher.final()]);
   
      const pass= encrypted.toString('base64');
    
      
      if(pass==user.Password)
      {
        return NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        email: user.UserID,
        username: user.UserName,
      },
    });

      }
      else
      {
        return NextResponse.json(
        { success: false, message: "Invalid credentials" },
        { status: 401 }
      );

      }

    // Compare bcrypt password
    // const isMatch = await bcrypt.compare(password, user.Password);

    // if (!isMatch) {
    //   return NextResponse.json(
    //     { success: false, message: "Invalid credentials" },
    //     { status: 401 }
    //   );
    // }

    // // ✅ Successful login
    // return NextResponse.json({
    //   success: true,
    //   message: "Login successful",
    //   user: {
    //     email: user.UserID,
    //     username: user.UserName,
    //   },
    // });
  } catch (error) {
    console.error("Login API Error:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
