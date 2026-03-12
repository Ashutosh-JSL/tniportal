import { NextResponse } from "next/server";
import sql from "mssql";

const config = {
  user: "sa",
  password: "Jindal@pex2020",
  server: "10.7.81.3",
  database: "TNIP_NEW",
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
};

export async function GET() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT skill_id, skill_name
      FROM dbo.Skills
      ORDER BY skill_name
    `);
    return NextResponse.json(result.recordset);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { skill_name } = await req.json();

    if (!skill_name) {
      return NextResponse.json(
        { error: "Skill name required" },
        { status: 400 }
      );
    }

    const pool = await sql.connect(config);

    await pool.request()
      .input("skill_name", sql.VarChar(100), skill_name)
      .query(`INSERT INTO dbo.Skills (skill_name) VALUES (@skill_name)`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Insert failed" },
      { status: 500 }
    );
  }
}
