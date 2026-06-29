import { NextResponse } from "next/server";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";

type SessionUser = {
  employeeCode?: string;
  username?: string;
  roles?: string[];
};

async function getAuthorizedUser() {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser | undefined) ?? null;
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

/* ===================== GET ===================== */
export async function GET(req: Request) {
  try {
    const currentUser = await getAuthorizedUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Admin can view all authorization requests
    if (!currentUser.roles?.includes("Admin")) {
      return NextResponse.json([], { status: 200 }); // Return empty for non-admins
    }

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    const result = await pool.request().query(`
      SELECT
        TP.plan_id AS id,
        TP.plan_id AS source_plan_id,
        TP.employee_id AS emp_code,
        E.emp_name,
        TP.plan_desc,
        ISNULL(TP.plan_type, 'Training') AS plan_type,
        TP.project_skill_names,
        TP.year,
        TP.responsible_person,
        TP.target_date,
        TP.training_location,
        TP.CrBy AS requested_by,
        TP.UpBy AS requested_by_name,
        CASE WHEN TP.status = 1 THEN 'Pending' ELSE 'Rejected' END AS status,
        TP.created_at AS requested_at,
        TP.reviewed_by,
        (SELECT TOP 1 emp_name FROM dbo.Employees WHERE emp_code = TP.reviewed_by) AS reviewed_by_name,
        TP.reviewed_at
      FROM dbo.TrainingPlan TP
      INNER JOIN dbo.Employees E ON TP.employee_id = E.emp_code
      WHERE TP.IsActive = 1
        AND (TP.status = 0 OR TP.status = 1)
      ORDER BY
        CASE WHEN TP.status = 1 THEN 0 ELSE 1 END,
        TP.created_at DESC
    `);

    return NextResponse.json(result.recordset || []);
  } catch (error) {
    console.error("TRAINING PLAN AUTH GET ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load training plan authorization requests" },
      { status: 500 },
    );
  }
}

/* ===================== POST ===================== */
export async function POST(req: Request) {
  try {
    const currentUser = await getAuthorizedUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Incharge users can submit authorization requests
    if (!currentUser.roles?.includes("Incharge")) {
      return NextResponse.json(
        { error: "Only incharge users can submit authorization requests" },
        { status: 403 },
      );
    }

    const { records } = await req.json();

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one record" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    for (const record of records) {
      const sourceId = Number(record.plan_id);

      if (!Number.isFinite(sourceId)) {
        continue;
      }

      // Update the plan status to Pending (string value)
      await pool.request()
        .input("plan_id", sql.Int, sourceId)
        .input("status", sql.NVarChar(20), "Pending")
        .query(`
          UPDATE dbo.TrainingPlan
          SET status = @status,
              UpBy = @upby,
              UpDt = GETDATE()
          WHERE plan_id = @plan_id
        `);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("TRAINING PLAN AUTH POST ERROR:", error);
    return NextResponse.json(
      { error: "Failed to submit authorization request" },
      { status: 500 },
    );
  }
}

/* ===================== PATCH (Admin Approval/Rejection) ===================== */
export async function PATCH(req: Request) {
  try {
    const currentUser = await getAuthorizedUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only Admin can review authorization requests
    if (!currentUser.roles?.includes("Admin")) {
      return NextResponse.json(
        { error: "Only admin users can review authorization requests" },
        { status: 403 },
      );
    }

    const { id, action } = await req.json();
    const normalizedAction =
      action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "";

    if (!id || !normalizedAction) {
      return NextResponse.json(
        { error: "Invalid review request" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);

    await pool.request()
      .input("plan_id", sql.Int, Number(id))
      .input("status", sql.NVarChar(20), normalizedAction)
      .input(
        "reviewed_by",
        sql.VarChar(20),
        String(currentUser.employeeCode ?? ""),
      )
      .query(`
        UPDATE dbo.TrainingPlan
        SET
          status = @status,
          reviewed_by = @reviewed_by,
          reviewed_at = GETDATE()
        WHERE plan_id = @plan_id
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("TRAINING PLAN AUTH PATCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update authorization request" },
      { status: 500 },
    );
  }
}
