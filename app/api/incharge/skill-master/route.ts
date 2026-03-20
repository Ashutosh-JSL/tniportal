import { NextResponse } from "next/server";
import sql from "mssql";

const config = {
  user: "sa",
  password: "Ashusolid@1234",
  server: "JSLLAP0727",
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
  } catch (error) {
    console.error("SKILL MASTER GET ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { skill_name } = await req.json();
    const normalizedSkill = String(skill_name ?? "").trim();

    if (!normalizedSkill) {
      return NextResponse.json(
        { error: "Skill name required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);

    await pool.request()
      .input("skill_name", sql.VarChar(100), normalizedSkill)
      .query(`INSERT INTO dbo.Skills (skill_name) VALUES (@skill_name)`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SKILL MASTER POST ERROR:", error);
    return NextResponse.json(
      { error: "Insert failed" },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const { skill_id, skill_name } = await req.json();
    const normalizedSkill = String(skill_name ?? "").trim();

    if (!skill_id || !normalizedSkill) {
      return NextResponse.json(
        { error: "Skill id and skill name are required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);

    await pool.request()
      .input("skill_id", sql.Int, Number(skill_id))
      .input("skill_name", sql.VarChar(100), normalizedSkill)
      .query(`
        UPDATE dbo.Skills
        SET skill_name = @skill_name
        WHERE skill_id = @skill_id
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SKILL MASTER PUT ERROR:", error);
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { skill_id } = await req.json();

    if (!skill_id) {
      return NextResponse.json(
        { error: "Skill id required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);

    await pool.request()
      .input("skill_id", sql.Int, Number(skill_id))
      .query(`DELETE FROM dbo.Skills WHERE skill_id = @skill_id`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SKILL MASTER DELETE ERROR:", error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 },
    );
  }
}
