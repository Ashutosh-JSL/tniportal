import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getConnection } from "@/lib/dbConnect";

/* ================= GET ROLE ASSIGNMENTS ================= */
export async function GET() {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        ra.RAID,
        ra.UserID,
        ra.Role_ID,
        rm.Role_Desc,
        ra.CrDt
      FROM Role_Auth ra
      LEFT JOIN Role_Master rm
        ON ra.Role_ID = rm.Role_ID
      ORDER BY ra.RAID
    `);

    return NextResponse.json(result.recordset);

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch role assignments" },
      { status: 500 }
    );
  }
}

/* ================= INSERT ROLE ================= */
export async function POST(req: NextRequest) {
  try {
    const { userId, roleId } = await req.json();

    const pool = await getConnection();

    await pool
      .request()
      .input("userId", sql.NVarChar(50), userId)
      .input("roleId", sql.Int, roleId)
      .query(`
        INSERT INTO Role_Auth (UserID, Role_ID)
        VALUES (@userId, @roleId)
      `);

    return NextResponse.json({ message: "Role assigned successfully" });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Insert failed" },
      { status: 500 }
    );
  }
}