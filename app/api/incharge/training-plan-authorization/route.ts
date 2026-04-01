import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import { getConnection } from "@/lib/dbConnect";

type SessionUser = {
  employeeCode?: string;
  username?: string;
  roles?: string[];
};

async function getAuthorizedUser() {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser | undefined) ?? null;
}

async function ensureQueueTable(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.TrainingPlanAuthorizationQueue', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TrainingPlanAuthorizationQueue (
        id INT IDENTITY(1,1) PRIMARY KEY,
        source_plan_id INT NULL,
        emp_code VARCHAR(20) NOT NULL,
        emp_name NVARCHAR(100) NULL,
        plan_desc NVARCHAR(255) NOT NULL,
        plan_type NVARCHAR(20) NOT NULL DEFAULT 'Training',
        project_skill_names NVARCHAR(MAX) NULL,
        [year] VARCHAR(10) NULL,
        responsible_person NVARCHAR(150) NULL,
        target_date DATE NULL,
        training_location NVARCHAR(20) NULL,
        requested_by VARCHAR(20) NOT NULL,
        requested_by_name NVARCHAR(100) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        requested_at DATETIME NOT NULL DEFAULT GETDATE(),
        reviewed_by VARCHAR(20) NULL,
        reviewed_by_name NVARCHAR(100) NULL,
        reviewed_at DATETIME NULL
      )
    END

    IF COL_LENGTH('dbo.TrainingPlanAuthorizationQueue', 'plan_type') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlanAuthorizationQueue
      ADD plan_type NVARCHAR(20) NOT NULL CONSTRAINT DF_TrainingPlanAuthorizationQueue_plan_type DEFAULT 'Training'
    END

    IF COL_LENGTH('dbo.TrainingPlanAuthorizationQueue', 'project_skill_names') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlanAuthorizationQueue
      ADD project_skill_names NVARCHAR(MAX) NULL
    END
  `);
}

export async function GET() {
  try {
    const currentUser = await getAuthorizedUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await getConnection();
    await ensureQueueTable(pool);

    const result = await pool.request().query(`
      SELECT
        id,
        source_plan_id,
        emp_code,
        emp_name,
        plan_desc,
        plan_type,
        project_skill_names,
        [year],
        responsible_person,
        target_date,
        training_location,
        requested_by,
        requested_by_name,
        status,
        requested_at,
        reviewed_by,
        reviewed_by_name,
        reviewed_at
      FROM dbo.TrainingPlanAuthorizationQueue
      ORDER BY
        CASE WHEN status = 'Pending' THEN 0 ELSE 1 END,
        requested_at DESC
    `);

    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error("TRAINING PLAN AUTH GET ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load training plan authorization requests" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getAuthorizedUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const pool = await getConnection();
    await ensureQueueTable(pool);

    const submittedIds: number[] = [];

    for (const record of records) {
      const sourceId = Number(record.plan_id);

      if (!Number.isFinite(sourceId)) {
        continue;
      }

      const existing = await pool
        .request()
        .input("source_plan_id", sql.Int, sourceId)
        .query(`
          SELECT TOP 1 id
          FROM dbo.TrainingPlanAuthorizationQueue
          WHERE source_plan_id = @source_plan_id
            AND status = 'Pending'
        `);

      if (existing.recordset.length > 0) {
        submittedIds.push(sourceId);
        continue;
      }

      await pool
        .request()
        .input("source_plan_id", sql.Int, sourceId)
        .input("emp_code", sql.VarChar(20), String(record.employee_id ?? ""))
        .input("emp_name", sql.NVarChar(100), String(record.emp_name ?? ""))
        .input("plan_desc", sql.NVarChar(255), String(record.plan_desc ?? ""))
        .input(
          "plan_type",
          sql.NVarChar(20),
          String(record.plan_type ?? "Training") === "Project" ? "Project" : "Training",
        )
        .input(
          "project_skill_names",
          sql.NVarChar(sql.MAX),
          String(record.project_skill_names ?? "").trim() || null,
        )
        .input("year", sql.VarChar(10), String(record.year ?? ""))
        .input(
          "responsible_person",
          sql.NVarChar(150),
          String(record.responsible_person ?? ""),
        )
        .input("target_date", sql.Date, record.target_date || null)
        .input(
          "training_location",
          sql.NVarChar(20),
          String(record.training_location ?? ""),
        )
        .input(
          "requested_by",
          sql.VarChar(20),
          String(currentUser.employeeCode ?? ""),
        )
        .input(
          "requested_by_name",
          sql.NVarChar(100),
          String(currentUser.username ?? ""),
        )
        .query(`
          INSERT INTO dbo.TrainingPlanAuthorizationQueue
          (
            source_plan_id,
            emp_code,
            emp_name,
            plan_desc,
            plan_type,
            project_skill_names,
            [year],
            responsible_person,
            target_date,
            training_location,
            requested_by,
            requested_by_name
          )
          VALUES
          (
            @source_plan_id,
            @emp_code,
            @emp_name,
            @plan_desc,
            @plan_type,
            @project_skill_names,
            @year,
            @responsible_person,
            @target_date,
            @training_location,
            @requested_by,
            @requested_by_name
          )
        `);

      submittedIds.push(sourceId);
    }

    return NextResponse.json({ success: true, submittedIds });
  } catch (error) {
    console.error("TRAINING PLAN AUTH POST ERROR:", error);
    return NextResponse.json(
      { error: "Failed to submit authorization request" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getAuthorizedUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const pool = await getConnection();
    await ensureQueueTable(pool);

    await pool
      .request()
      .input("id", sql.Int, Number(id))
      .input("status", sql.NVarChar(20), normalizedAction)
      .input(
        "reviewed_by",
        sql.VarChar(20),
        String(currentUser.employeeCode ?? ""),
      )
      .input(
        "reviewed_by_name",
        sql.NVarChar(100),
        String(currentUser.username ?? ""),
      )
      .query(`
        UPDATE dbo.TrainingPlanAuthorizationQueue
        SET
          status = @status,
          reviewed_by = @reviewed_by,
          reviewed_by_name = @reviewed_by_name,
          reviewed_at = GETDATE()
        WHERE id = @id
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
