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

/* ===================== GET ===================== */
export async function GET() {
  try {
    const pool = await sql.connect(config);

    const plans = await pool.request().query(`
      SELECT plan_master_id, plan_name
      FROM dbo.TrainingPlanMaster
    `);

    const skills = await pool.request().query(`
      SELECT skill_id, skill_name
      FROM dbo.Skills
    `);

    const employees = await pool.request().query(`
  SELECT
    
    emp_code,
    emp_name
  FROM dbo.Employees
  WHERE status = 1
  ORDER BY emp_name
`);


    const records = await pool.request().query(`
  SELECT
    MAX(TPS.id) AS id,
    TPM.plan_name,

    E.emp_code,        -- DISPLAY
    E.emp_name,        -- DISPLAY

    STRING_AGG(S.skill_name, ', ') AS skill_name,

    TPS.desired_level,
    TPS.actual_level,
    TPS.gap

  FROM dbo.TrainingPlanSkills TPS

  JOIN dbo.TrainingPlanMaster TPM
    ON TPS.plan_master_id = TPM.plan_master_id

  JOIN dbo.Skills S
    ON TPS.skill_id = S.skill_id

  LEFT JOIN dbo.Employees E
    ON TPS.employee_id = E.emp_code     -- ✅ FIXED

  GROUP BY
    TPM.plan_name,
    E.emp_code,
    E.emp_name,
    TPS.desired_level,
    TPS.actual_level,
    TPS.gap

  ORDER BY MAX(TPS.id) DESC;
`);


    return NextResponse.json(
      {
        plans: plans.recordset,
        skills: skills.recordset,
        employees: employees.recordset,
        records: records.recordset,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { plans: [], skills: [], employees: [], records: [] },
      { status: 500 }
    );
  }
}

/* ===================== POST ===================== */
export async function POST(req: Request) {
  try {
    const {
      plan_master_id,
      skill_id,
      emp_code,
      desired_level,
      actual_level,
    } = await req.json();
    
    const pool = await sql.connect(config);

    await pool.request()
      .input("plan_master_id", sql.Int, plan_master_id)
      .input("skill_id", sql.Int, skill_id)
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("desired_level", sql.Int, desired_level)
      .input("actual_level", sql.Int, actual_level)
      .query(`
        INSERT INTO dbo.TrainingPlanSkills
        (
          plan_master_id,
          skill_id,
          employee_id,
          desired_level,
          actual_level
        )
        VALUES
        (
          @plan_master_id,
          @skill_id,
          @emp_code,
          @desired_level,
          @actual_level
        )
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}
