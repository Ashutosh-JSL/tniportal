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

function parseNullableInt(value: unknown): number | null {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

async function getAuthorizedUser() {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser | undefined) ?? null;
}

async function ensureQueueTable(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF OBJECT_ID('dbo.PostTrainingAuthorizationQueue', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.PostTrainingAuthorizationQueue (
        id INT IDENTITY(1,1) PRIMARY KEY,
        source_plan_id INT NULL,
        source_row_key NVARCHAR(255) NULL,
        emp_code VARCHAR(20) NOT NULL,
        emp_name NVARCHAR(100) NULL,
        plan_desc NVARCHAR(255) NOT NULL,
        [year] VARCHAR(10) NULL,
        responsible_person NVARCHAR(150) NULL,
        target_date DATE NULL,
        Completion_date DATE NULL,
        training_location NVARCHAR(50) NULL,
        project_skill_names NVARCHAR(MAX) NULL,
        target_outcome NVARCHAR(200) NULL,
        actual_outcome NVARCHAR(200) NULL,
        effectiveness_desired INT NULL,
        effectiveness_actual INT NULL,
        effectiveness_gap INT NULL,
        gap_fulfilled BIT NULL,
        key_learnings NVARCHAR(MAX) NULL,
        evidence_file NVARCHAR(255) NULL,
        requested_by VARCHAR(20) NOT NULL,
        requested_by_name NVARCHAR(100) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        requested_at DATETIME NOT NULL DEFAULT GETDATE(),
        reviewed_by VARCHAR(20) NULL,
        reviewed_by_name NVARCHAR(100) NULL,
        reviewed_at DATETIME NULL
      )
    END
  `);

  await pool.request().query(`
    IF COL_LENGTH('dbo.PostTrainingAuthorizationQueue', 'source_row_key') IS NULL
    BEGIN
      ALTER TABLE dbo.PostTrainingAuthorizationQueue
      ADD source_row_key NVARCHAR(255) NULL
    END

    IF COL_LENGTH('dbo.PostTrainingAuthorizationQueue', 'project_skill_names') IS NULL
    BEGIN
      ALTER TABLE dbo.PostTrainingAuthorizationQueue
      ADD project_skill_names NVARCHAR(MAX) NULL
    END

    IF COL_LENGTH('dbo.PostTrainingAuthorizationQueue', 'target_outcome') IS NULL
    BEGIN
      ALTER TABLE dbo.PostTrainingAuthorizationQueue
      ADD target_outcome NVARCHAR(200) NULL
    END

    IF COL_LENGTH('dbo.PostTrainingAuthorizationQueue', 'actual_outcome') IS NULL
    BEGIN
      ALTER TABLE dbo.PostTrainingAuthorizationQueue
      ADD actual_outcome NVARCHAR(200) NULL
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
        source_row_key,
        emp_code,
        emp_name,
        plan_desc,
        [year],
        responsible_person,
        target_date,
        Completion_date,
        training_location,
        project_skill_names,
        target_outcome,
        actual_outcome,
        effectiveness_desired,
        effectiveness_actual,
        effectiveness_gap,
        gap_fulfilled,
        key_learnings,
        evidence_file,
        requested_by,
        requested_by_name,
        status,
        requested_at,
        reviewed_by,
        reviewed_by_name,
        reviewed_at
      FROM dbo.PostTrainingAuthorizationQueue
      ORDER BY
        CASE WHEN status = 'Pending' THEN 0 ELSE 1 END,
        requested_at DESC
    `);

    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error("POST TRAINING AUTH GET ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load post-training authorization requests" },
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

    const submittedIds: string[] = [];

    for (const record of records) {
      const sourceId = Number(record.plan_id);
      const sourceRowKey = String(record.row_key ?? "");
      const targetOutcome = String(
        record.target_outcome ?? record.effectiveness_desired ?? "",
      ).trim();
      const actualOutcome = String(
        record.actual_outcome ?? record.effectiveness_actual ?? "",
      ).trim();
      const effectivenessDesired =
        parseNullableInt(record.effectiveness_desired ?? targetOutcome);
      const effectivenessActual =
        parseNullableInt(record.effectiveness_actual ?? actualOutcome);
      const effectivenessGap =
        effectivenessDesired !== null && effectivenessActual !== null
          ? effectivenessDesired - effectivenessActual
          : null;

      if (!Number.isFinite(sourceId) || !sourceRowKey) {
        continue;
      }

      const existing = await pool.request()
        .input("source_row_key", sql.NVarChar(255), sourceRowKey)
        .query(`
          SELECT TOP 1 id
          FROM dbo.PostTrainingAuthorizationQueue
          WHERE source_row_key = @source_row_key
            AND status = 'Pending'
        `);

      if (existing.recordset.length > 0) {
        submittedIds.push(sourceRowKey);
        continue;
      }

      await pool.request()
        .input("source_plan_id", sql.Int, sourceId)
        .input("source_row_key", sql.NVarChar(255), sourceRowKey)
        .input("emp_code", sql.VarChar(20), String(record.employee_id ?? ""))
        .input("emp_name", sql.NVarChar(100), String(record.emp_name ?? ""))
        .input("plan_desc", sql.NVarChar(255), String(record.plan_desc ?? ""))
        .input("year", sql.VarChar(10), String(record.year ?? ""))
        .input(
          "responsible_person",
          sql.NVarChar(150),
          String(record.responsible_person ?? ""),
        )
        .input("target_date", sql.Date, record.target_date || null)
        .input("Completion_date", sql.Date, record.Completion_date || null)
        .input(
          "training_location",
          sql.NVarChar(50),
          String(record.training_location ?? ""),
        )
        .input(
          "project_skill_names",
          sql.NVarChar(sql.MAX),
          String(record.project_skill_names ?? "").trim() || null,
        )
        .input("target_outcome", sql.NVarChar(200), targetOutcome || null)
        .input("actual_outcome", sql.NVarChar(200), actualOutcome || null)
        .input(
          "effectiveness_desired",
          sql.Int,
          effectivenessDesired,
        )
        .input(
          "effectiveness_actual",
          sql.Int,
          effectivenessActual,
        )
        .input(
          "effectiveness_gap",
          sql.Int,
          effectivenessGap,
        )
        .input("gap_fulfilled", sql.Bit, Boolean(record.gap_fulfilled))
        .input("key_learnings", sql.NVarChar(sql.MAX), String(record.key_learnings ?? ""))
        .input("evidence_file", sql.NVarChar(255), String(record.evidence_file ?? ""))
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
          INSERT INTO dbo.PostTrainingAuthorizationQueue
          (
            source_plan_id,
            source_row_key,
            emp_code,
            emp_name,
            plan_desc,
            [year],
            responsible_person,
            target_date,
            Completion_date,
            training_location,
            project_skill_names,
            target_outcome,
            actual_outcome,
            effectiveness_desired,
            effectiveness_actual,
            effectiveness_gap,
            gap_fulfilled,
            key_learnings,
            evidence_file,
            requested_by,
            requested_by_name
          )
          VALUES
          (
            @source_plan_id,
            @source_row_key,
            @emp_code,
            @emp_name,
            @plan_desc,
            @year,
            @responsible_person,
            @target_date,
            @Completion_date,
            @training_location,
            @project_skill_names,
            @target_outcome,
            @actual_outcome,
            @effectiveness_desired,
            @effectiveness_actual,
            @effectiveness_gap,
            @gap_fulfilled,
            @key_learnings,
            @evidence_file,
            @requested_by,
            @requested_by_name
          )
        `);

      submittedIds.push(sourceRowKey);
    }

    return NextResponse.json({ success: true, submittedIds });
  } catch (error) {
    console.error("POST TRAINING AUTH POST ERROR:", error);
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

    await pool.request()
      .input("id", sql.Int, Number(id))
      .input("status", sql.NVarChar(20), normalizedAction)
      .input("reviewed_by", sql.VarChar(20), String(currentUser.employeeCode ?? ""))
      .input(
        "reviewed_by_name",
        sql.NVarChar(100),
        String(currentUser.username ?? ""),
      )
      .query(`
        UPDATE dbo.PostTrainingAuthorizationQueue
        SET
          status = @status,
          reviewed_by = @reviewed_by,
          reviewed_by_name = @reviewed_by_name,
          reviewed_at = GETDATE()
        WHERE id = @id
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST TRAINING AUTH PATCH ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update authorization request" },
      { status: 500 },
    );
  }
}
