import { NextResponse } from "next/server";
import { getConnection } from "@/lib/dbConnect";

export async function GET() {
  try {
    console.log("ROLES API CALLED");

    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT Role_ID, Role_Desc
      FROM dbo.Role_Master
      ORDER BY Role_Desc
    `);

    console.log("Roles fetched:", result.recordset);

    return NextResponse.json(result.recordset);

  } catch (error: any) {
    console.error("ROLES API ERROR:", error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}