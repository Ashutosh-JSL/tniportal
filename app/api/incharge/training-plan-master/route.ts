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

/* ================= GET ================= */
export async function GET() {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT 
        plan_master_id,
        plan_Heading,
        plan_Desc,
        created_at
      FROM dbo.TrainingPlanMaster
      ORDER BY plan_master_id DESC
    `);

    return NextResponse.json(result.recordset, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}

/* ================= POST ================= */
export async function POST(req: Request) {
  try {
    const { plan_Heading, plan_Desc } = await req.json();

    if (!plan_Heading) {
      return NextResponse.json(
        { error: "Plan heading required" },
        { status: 400 }
      );
    }

    const pool = await sql.connect(config);

    await pool.request()
      .input("plan_Heading", sql.NVarChar(500), plan_Heading)
      .input("plan_Desc", sql.VarChar(255), plan_Desc || null)
      .query(`
        INSERT INTO dbo.TrainingPlanMaster
        (plan_Heading, plan_Desc)
        VALUES
        (@plan_Heading, @plan_Desc)
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Insert failed" },
      { status: 500 }
    );
  }
}