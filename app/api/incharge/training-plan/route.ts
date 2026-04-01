import { NextResponse } from "next/server";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";

type SessionUser = {
  id?: string;
  employeeCode?: string;
};

async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return String(user?.employeeCode ?? user?.id ?? "").trim();
}

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

const normalizePlanType = (value: unknown): "Training" | "Project" =>
  value === "Project" ? "Project" : "Training";

const normalizeProjectSkills = (value: unknown): string =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");

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

/* ===================== POST ===================== */
export async function POST(req: Request) {

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("RECEIVED:", body);


    const {
      plan_desc,
      employee_id,
      year,
      responsible_person,
      target_date,
      training_location,
      plan_type,
      project_skill_names,
    } = body;
    const normalizedPlanType = normalizePlanType(plan_type);
    const normalizedProjectSkills =
      normalizedPlanType === "Project"
        ? normalizeProjectSkills(project_skill_names)
        : "";

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    await pool.request()
      .input("employee_id", sql.VarChar(50), employee_id)
      .input("plan_desc", sql.VarChar(255), plan_desc)
      .input("year", sql.VarChar(10), year || null)
      .input("responsible_person", sql.NVarChar(150), responsible_person || null)
      .input("target_date", sql.Date, target_date || null)
      .input("training_location", sql.NVarChar(20), training_location || null)
      .input("plan_type", sql.NVarChar(20), normalizedPlanType)
      .input("project_skill_names", sql.NVarChar(sql.MAX), normalizedProjectSkills || null)
      .input("status", sql.Bit, 1)
      .input("CrBy", sql.VarChar(20), userId)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        INSERT INTO dbo.TrainingPlan
        (
          employee_id,
          plan_desc,
          year,
          responsible_person,
          target_date,
          training_location,
          plan_type,
          project_skill_names,
          status,
          created_at,
          IsActive,
          CrBy,
          CrDt,
          UpBy,
          UpDt
        )
        VALUES
        (
          @employee_id,
          @plan_desc,
          @year,
          @responsible_person,
          @target_date,
          @training_location,
          @plan_type,
          @project_skill_names,
          @status,
          GETDATE(),
          1,
          @CrBy,
          GETDATE(),
          @UpBy,
          GETDATE()
        )
      `);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("POST ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}

/* ===================== GET ===================== */
export async function GET(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    const { searchParams } = new URL(req.url);
    const rawPlanType = searchParams.get("plan_type");
    const planTypeFilter =
      rawPlanType === "Training" || rawPlanType === "Project"
        ? rawPlanType
        : null;

    const result = await pool.request()
      .input("user_id", sql.VarChar(20), userId)
      .input("plan_type", sql.NVarChar(20), planTypeFilter)
      .query(`
        SELECT
          TP.plan_id,
          TP.plan_desc,
          TP.year,
          TP.responsible_person,
          TP.target_date,
          TP.training_location,
          TP.employee_id,
          ISNULL(TP.plan_type, 'Training') AS plan_type,
          TP.project_skill_names,
          E.emp_name
        FROM dbo.TrainingPlan TP
        INNER JOIN dbo.Employees E
          ON TP.employee_id = E.emp_code
        WHERE TP.IsActive = 1
          AND (TP.CrBy = @user_id OR TP.UpBy = @user_id)
          AND (@plan_type IS NULL OR ISNULL(TP.plan_type, 'Training') = @plan_type)
        ORDER BY TP.plan_id DESC
      `);

    return NextResponse.json(result.recordset || []);

  } catch (error) {
    console.error("GET ERROR:", error);
    return NextResponse.json([]);
  }
}

/* ===================== PUT ===================== */
export async function PUT(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      plan_id,
      plan_desc,
      employee_id,
      year,
      responsible_person,
      target_date,
      training_location,
      plan_type,
      project_skill_names,
    } = await req.json();
    const normalizedPlanType = normalizePlanType(plan_type);
    const normalizedProjectSkills =
      normalizedPlanType === "Project"
        ? normalizeProjectSkills(project_skill_names)
        : "";

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    await pool.request()
      .input("plan_id", sql.Int, plan_id)
      .input("employee_id", sql.VarChar(50), employee_id)
      .input("plan_desc", sql.VarChar(255), plan_desc)
      .input("year", sql.VarChar(10), year || null)
      .input("responsible_person", sql.NVarChar(150), responsible_person || null)
      .input("target_date", sql.Date, target_date || null)
      .input("training_location", sql.NVarChar(20), training_location || null)
      .input("plan_type", sql.NVarChar(20), normalizedPlanType)
      .input("project_skill_names", sql.NVarChar(sql.MAX), normalizedProjectSkills || null)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        UPDATE dbo.TrainingPlan
        SET
          employee_id = @employee_id,
          plan_desc = @plan_desc,
          year = @year,
          responsible_person = @responsible_person,
          target_date = @target_date,
          training_location = @training_location,
          plan_type = @plan_type,
          project_skill_names = @project_skill_names,
          UpBy = @UpBy,
          UpDt = GETDATE()
        WHERE plan_id = @plan_id
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}


/* ===================== DELETE ===================== */
export async function DELETE(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan_id } = await req.json();

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    await pool.request()
      .input("plan_id", sql.Int, plan_id)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        UPDATE dbo.TrainingPlan
        SET
          IsActive = 0,
          status = 0,
          UpBy = @UpBy,
          UpDt = GETDATE()
        WHERE plan_id = @plan_id
      `);

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
