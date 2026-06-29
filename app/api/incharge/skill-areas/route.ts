import { NextResponse } from "next/server";
import sql from "mssql";

const config = {
  user: "sa",
  password: "Jindal@pex2020",
  server: "10.7.81.3",
  database: "TNIP_NEW_update",
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
};

export async function GET() {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT ID AS id, SKILL_AREA AS skill_area
      FROM dbo.SKILL_AREA
      WHERE IsActive = 1 OR IsActive IS NULL
      ORDER BY SKILL_AREA
    `);

    return NextResponse.json(result.recordset);
  } catch (err) {
    console.error("Error fetching skill areas:", err);
    return NextResponse.json([], { status: 500 });
  }
}
