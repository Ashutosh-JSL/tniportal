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
    const heading = String(plan_Heading ?? "").trim();
    const description = String(plan_Desc ?? "").trim();

    if (!heading) {
      return NextResponse.json(
        { error: "Plan heading required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);

    await pool.request()
      .input("plan_Heading", sql.NVarChar(500), heading)
      .input("plan_Desc", sql.VarChar(255), description || null)
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
      { status: 500 },
    );
  }
}

/* ================= PUT ================= */
export async function PUT(req: Request) {
  try {
    const { plan_master_id, plan_Heading, plan_Desc } = await req.json();
    const heading = String(plan_Heading ?? "").trim();
    const description = String(plan_Desc ?? "").trim();

    if (!plan_master_id || !heading) {
      return NextResponse.json(
        { error: "Plan id and heading are required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);

    await pool.request()
      .input("plan_master_id", sql.Int, Number(plan_master_id))
      .input("plan_Heading", sql.NVarChar(500), heading)
      .input("plan_Desc", sql.VarChar(255), description || null)
      .query(`
        UPDATE dbo.TrainingPlanMaster
        SET
          plan_Heading = @plan_Heading,
          plan_Desc = @plan_Desc
        WHERE plan_master_id = @plan_master_id
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 },
    );
  }
}

/* ================= DELETE ================= */
export async function DELETE(req: Request) {
  try {
    const { plan_master_id } = await req.json();

    if (!plan_master_id) {
      return NextResponse.json(
        { error: "Plan id required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);

    await pool.request()
      .input("plan_master_id", sql.Int, Number(plan_master_id))
      .query(`DELETE FROM dbo.TrainingPlanMaster WHERE plan_master_id = @plan_master_id`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 },
    );
  }
}
