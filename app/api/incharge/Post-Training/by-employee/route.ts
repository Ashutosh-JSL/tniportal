import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getConnection } from "@/lib/dbConnect";

async function ensureTrainingPlanSchema(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF COL_LENGTH('dbo.TrainingPlan', 'plan_type') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlan ADD plan_type NVARCHAR(20) NULL
      UPDATE dbo.TrainingPlan SET plan_type = 'Training' WHERE plan_type IS NULL
    END

    IF COL_LENGTH('dbo.TrainingPlan', 'project_skill_names') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlan ADD project_skill_names NVARCHAR(MAX) NULL
    END
  `);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empId = searchParams.get("empId");

    if (!empId) {
      return NextResponse.json([]);
    }

    const pool = await getConnection();
    await ensureTrainingPlanSchema(pool);
    const result = await pool.request()
      .input("empId", sql.VarChar(20), empId)
      .query(`
        SELECT
          plan_id,
          plan_desc,
          year,
          responsible_person,
          target_date,
          training_location,
          ISNULL(plan_type, 'Training') AS plan_type,
          project_skill_names
        FROM dbo.TrainingPlan
        WHERE employee_id = @empId
          AND ISNULL(IsActive, 1) = 1
        ORDER BY plan_id DESC
      `);

    return NextResponse.json(result.recordset || []);
  } catch (error) {
    console.error("POST TRAINING BY EMPLOYEE ERROR:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
