import { NextResponse } from "next/server";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";

type SessionUser = {
  id?: string;
  employeeCode?: string;
  username?: string;
  roles?: string[];
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

    IF COL_LENGTH('dbo.TrainingPlan', 'plan_master_id') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlan ADD plan_master_id INT NULL
    END

    -- Add status column if not exists (unified authorization)
    IF COL_LENGTH('dbo.TrainingPlan', 'status') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlan ADD status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_TrainingPlan_status DEFAULT 'Pending'
        WITH VALUES
    END

    -- Add reviewed_by columns for tracking approval history
    IF COL_LENGTH('dbo.TrainingPlan', 'reviewed_by') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlan ADD reviewed_by NVARCHAR(50) NULL
    END

    IF COL_LENGTH('dbo.TrainingPlan', 'reviewed_at') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlan ADD reviewed_at DATETIME NULL
    END
  `);
}

async function isApprovedPlanHeading(
  pool: sql.ConnectionPool,
  planHeading: unknown,
) {
  const normalizedPlanHeading = String(planHeading ?? "").trim();

  if (!normalizedPlanHeading) {
    return false;
  }

  const result = await pool.request()
    .input("plan_Heading", sql.NVarChar(500), normalizedPlanHeading)
    .query(`
      SELECT TOP 1 plan_master_id
      FROM dbo.TrainingPlanMaster
      WHERE plan_Heading = @plan_Heading
        AND approval_status = 'Approved'
    `);

  return result.recordset.length > 0;
}

async function getPlanMasterDataByHeading(
  pool: sql.ConnectionPool,
  planHeading: unknown,
) {
  const normalizedPlanHeading = String(planHeading ?? "").trim();

  if (!normalizedPlanHeading) {
    return null;
  }

  const result = await pool.request()
    .input("plan_Heading", sql.NVarChar(500), normalizedPlanHeading)
    .query(`
      SELECT TOP 1 plan_master_id, skill_area_id
      FROM dbo.TrainingPlanMaster
      WHERE plan_Heading = @plan_Heading
    `);

  return result.recordset[0] || null;
}

async function isAdminUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return user?.roles?.includes("Admin") ?? false;
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
      skill_area_id,
      plan_master_id,
    } = body;
    const normalizedPlanType = normalizePlanType(plan_type);
    const normalizedProjectSkills =
      normalizedPlanType === "Project"
        ? normalizeProjectSkills(project_skill_names)
        : "";

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    // Get plan_master_id from plan_desc if not provided
    let finalPlanMasterId: number | null = plan_master_id || null;
    let finalSkillAreaId = skill_area_id;

    if (!finalPlanMasterId && plan_desc) {
      const masterData = await getPlanMasterDataByHeading(pool, plan_desc);
      if (masterData) {
        finalPlanMasterId = masterData.plan_master_id;
        // Use skill_area from master only if not explicitly provided
        if (finalSkillAreaId === undefined || finalSkillAreaId === null) {
          finalSkillAreaId = masterData.skill_area_id;
        }
      }
    } else if (!finalPlanMasterId && !plan_desc) {
      return NextResponse.json(
        { error: "Either plan_desc or plan_master_id is required" },
        { status: 400 }
      );
    }

    await pool.request()
      .input("employee_id", sql.VarChar(50), employee_id)
      .input("plan_desc", sql.VarChar(255), plan_desc || null)
      .input("year", sql.VarChar(10), year || null)
      .input("responsible_person", sql.NVarChar(150), responsible_person || null)
      .input("target_date", sql.Date, target_date || null)
      .input("training_location", sql.NVarChar(20), training_location || null)
      .input("plan_type", sql.NVarChar(20), normalizedPlanType)
      .input("project_skill_names", sql.NVarChar(sql.MAX), normalizedProjectSkills || null)
      .input("skill_area_id", sql.Int, finalSkillAreaId || null)
      .input("plan_master_id", sql.Int, finalPlanMasterId)
      .input("status", sql.NVarChar(20), "Pending") // All new plans start as Pending
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
          Skill_Area_Id,
          plan_master_id,
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
          @skill_area_id,
          @plan_master_id,
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
    const skillAreaId = searchParams.get("skill_area_id");
    const statusFilter = searchParams.get("status"); // Filter by authorization status
    const showAll = searchParams.get("showAll") === "true"; // Show all plans regardless of user
    const planTypeFilter =
      rawPlanType === "Training" || rawPlanType === "Project"
        ? rawPlanType
        : null;

    let query = `
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
        TP.plan_master_id,
        E.emp_name,
        tpm.skill_area_id,
        sa.SKILL_AREA AS skill_area_name,
        TP.status,
        CASE WHEN TP.status = 1 THEN 'Pending' ELSE 'Rejected' END AS display_status,
        TP.reviewed_by,
        TP.reviewed_at
      FROM dbo.TrainingPlan TP
      INNER JOIN dbo.Employees E
        ON TP.employee_id = E.emp_code
      LEFT JOIN dbo.TrainingPlanMaster tpm
        ON tpm.plan_master_id = TP.plan_master_id
      LEFT JOIN dbo.SKILL_AREA sa
        ON sa.ID = COALESCE(TP.Skill_Area_Id, tpm.skill_area_id)
      WHERE TP.IsActive = 1
    `;

    const request = pool.request();

    // Show all plans (for admin) or only user's plans
    if (!showAll && !isAdminUser()) {
      query += ` AND (TP.CrBy = @user_id OR TP.UpBy = @user_id)`;
      request.input("user_id", sql.VarChar(20), userId);
    }

    if (skillAreaId && skillAreaId !== "null" && skillAreaId !== "") {
      query += ` AND COALESCE(TP.Skill_Area_Id, tpm.skill_area_id) = @skill_area_id`;
      request.input("skill_area_id", sql.Int, Number(skillAreaId));
    }

    if (planTypeFilter) {
      request.input("plan_type", sql.NVarChar(20), planTypeFilter);
      query += ` AND ISNULL(TP.plan_type, 'Training') = @plan_type`;
    }

    if (statusFilter && statusFilter !== "all") {
      request.input("status", sql.NVarChar(20), statusFilter);
      query += ` AND TP.status = @status`;
    }

    query += ` ORDER BY TP.plan_id DESC`;

    const result = await request.query(query);

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
      skill_area_id,
      plan_master_id,
    } = await req.json();
    const normalizedPlanType = normalizePlanType(plan_type);
    const normalizedProjectSkills =
      normalizedPlanType === "Project"
        ? normalizeProjectSkills(project_skill_names)
        : "";

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    if (!(await isApprovedPlanHeading(pool, plan_desc))) {
      return NextResponse.json(
        { error: "Only admin-approved training plans can be used" },
        { status: 400 },
      );
    }

    // Get skill_area_id from request body or master data
    let skillAreaIdValue = skill_area_id;
    if (skillAreaIdValue === undefined || skillAreaIdValue === null) {
      const masterData = await getPlanMasterDataByHeading(pool, plan_desc);
      skillAreaIdValue = masterData?.skill_area_id || null;
    }

    // Use plan_master_id from request or look it up
    let finalPlanMasterId = plan_master_id;
    if (!finalPlanMasterId && plan_desc) {
      const masterData = await getPlanMasterDataByHeading(pool, plan_desc);
      finalPlanMasterId = masterData?.plan_master_id || null;
    }

    // Reset status to Pending when editing
    await pool.request()
      .input("plan_id", sql.Int, plan_id)
      .input("employee_id", sql.VarChar(50), employee_id)
      .input("plan_desc", sql.NVarChar(255), plan_desc)
      .input("year", sql.VarChar(10), year || null)
      .input("responsible_person", sql.NVarChar(150), responsible_person || null)
      .input("target_date", sql.Date, target_date || null)
      .input("training_location", sql.NVarChar(20), training_location || null)
      .input("plan_type", sql.NVarChar(20), normalizedPlanType)
      .input("project_skill_names", sql.NVarChar(sql.MAX), normalizedProjectSkills || null)
      .input("skill_area_id", sql.Int, skillAreaIdValue || null)
      .input("plan_master_id", sql.Int, finalPlanMasterId)
      .input("status", sql.NVarChar(20), "Pending") // Reset to Pending when editing
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
          Skill_Area_Id = @skill_area_id,
          plan_master_id = @plan_master_id,
          status = @status,
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
      .input("status", sql.NVarChar(20), "Rejected") // Rejected status
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        UPDATE dbo.TrainingPlan
        SET
          IsActive = 0,
          status = @status,
          UpBy = @UpBy,
          UpDt = GETDATE()
        WHERE plan_id = @plan_id
      `);

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

/* ===================== PATCH (Admin Approval) ===================== */
export async function PATCH(req: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json(
        { error: "Only admin users can approve or reject training plans" },
        { status: 403 },
      );
    }

    const { plan_id, action } = await req.json();
    const normalizedAction =
      action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "";

    if (!plan_id || !normalizedAction) {
      return NextResponse.json(
        { error: "Plan id and valid action are required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    await pool.request()
      .input("plan_id", sql.Int, Number(plan_id))
      .input("status", sql.NVarChar(20), normalizedAction)
      .input(
        "reviewed_by",
        sql.VarChar(20),
        String((await getAuthorizedUser())?.employeeCode ?? ""),
      )
      .query(`
        UPDATE dbo.TrainingPlan
        SET
          status = @status,
          reviewed_at = GETDATE()
        WHERE plan_id = @plan_id
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH ERROR:", error);
    return NextResponse.json(
      { error: "Approval update failed" },
      { status: 500 },
    );
  }
}

async function getAuthorizedUser() {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser | undefined) ?? null;
}
