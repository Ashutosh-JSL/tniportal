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

    IF COL_LENGTH('dbo.TrainingPlan', 'plan_master_id') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlan ADD plan_master_id INT NULL
    END

    IF COL_LENGTH('dbo.TrainingPlan', 'Skill_Area_Id') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlan ADD Skill_Area_Id INT NULL
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
          TP.plan_id,
          TP.plan_desc,
          TP.year,
          TP.responsible_person,
          TP.target_date,
          TP.training_location,
          COALESCE(TP.Skill_Area_Id, tpm.skill_area_id) AS skill_area_id,
          sa.SKILL_AREA AS skill_area_name,
          ISNULL(TP.plan_type, 'Training') AS plan_type,
          TP.project_skill_names
        FROM dbo.TrainingPlan TP
        LEFT JOIN dbo.TrainingPlanMaster tpm
          ON tpm.plan_master_id = TP.plan_master_id
        LEFT JOIN dbo.SKILL_AREA sa
          ON sa.ID = COALESCE(TP.Skill_Area_Id, tpm.skill_area_id)
        WHERE LTRIM(RTRIM(TP.employee_id)) = LTRIM(RTRIM(@empId))
          AND ISNULL(TP.IsActive, 1) = 1
        ORDER BY TP.plan_id DESC
      `);

    return NextResponse.json(result.recordset || []);
  } catch (error) {
    console.error("POST TRAINING BY EMPLOYEE ERROR:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
