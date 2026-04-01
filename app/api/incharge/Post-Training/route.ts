import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import { getConnection } from "@/lib/dbConnect";

const ATTACHMENTS_DIR = path.join(process.cwd(), "app", "attachments");

type ParsedRowKey = {
  recordId: number;
  employeeId: string;
  createdAt: string;
};

type SessionUser = {
  id?: string;
  employeeCode?: string;
};

async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return String(user?.employeeCode ?? user?.id ?? "").trim();
}

async function saveEvidenceFile(file: File | null) {
  if (!file) {
    return null;
  }

  const safeOriginalName = path.basename(file.name);
  const fileName = `${Date.now()}_${safeOriginalName}`;
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ATTACHMENTS_DIR, fileName),
    Buffer.from(await file.arrayBuffer()),
  );

  return fileName;
}

function parseRowKey(rowKey: string | null | undefined): ParsedRowKey | null {
  if (!rowKey) {
    return null;
  }

  const parts = rowKey.split("|");

  if (parts.length === 3) {
    const [idPart, employeeId, createdAt] = parts;
    const recordId = Number(idPart);

    if (!Number.isFinite(recordId) || !employeeId || !createdAt) {
      return null;
    }

    return { recordId, employeeId, createdAt };
  }

  if (parts.length === 4) {
    const [, idPart, employeeId, createdAt] = parts;
    const recordId = Number(idPart);

    if (!Number.isFinite(recordId) || !employeeId || !createdAt) {
      return null;
    }

    return { recordId, employeeId, createdAt };
  }

  return null;
}

function parseNumericValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

async function ensurePostTrainingColumns(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF COL_LENGTH('dbo.Post_training_plan', 'source_plan_id') IS NULL
      ALTER TABLE dbo.Post_training_plan ADD source_plan_id INT NULL

    IF COL_LENGTH('dbo.Post_training_plan', 'project_skill_names') IS NULL
      ALTER TABLE dbo.Post_training_plan ADD project_skill_names NVARCHAR(MAX) NULL

    IF COL_LENGTH('dbo.Post_training_plan', 'target_outcome') IS NULL
      ALTER TABLE dbo.Post_training_plan ADD target_outcome NVARCHAR(200) NULL

    IF COL_LENGTH('dbo.Post_training_plan', 'actual_outcome') IS NULL
      ALTER TABLE dbo.Post_training_plan ADD actual_outcome NVARCHAR(200) NULL
  `);
}

/* ================= GET ================= */
export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await getConnection();
    await ensurePostTrainingColumns(pool);

    const result = await pool.request()
      .input("user_id", sql.NVarChar(50), userId)
      .query(`
        SELECT
          CONCAT(
            CAST(t.plan_id AS VARCHAR(20)),
            '|',
            ISNULL(t.employee_id, ''),
            '|',
            CONVERT(VARCHAR(33), t.created_at, 126)
          ) AS row_key,
          t.plan_id,
          t.source_plan_id,
          t.plan_desc,
          t.project_skill_names,
          COALESCE(
            NULLIF(LTRIM(RTRIM(t.target_outcome)), ''),
            CASE WHEN t.effectiveness_desired IS NULL THEN NULL ELSE CAST(t.effectiveness_desired AS NVARCHAR(50)) END
          ) AS target_outcome,
          COALESCE(
            NULLIF(LTRIM(RTRIM(t.actual_outcome)), ''),
            CASE WHEN t.effectiveness_actual IS NULL THEN NULL ELSE CAST(t.effectiveness_actual AS NVARCHAR(50)) END
          ) AS actual_outcome,
          CASE
            WHEN TRY_CONVERT(DECIMAL(18,4), COALESCE(NULLIF(LTRIM(RTRIM(t.target_outcome)), ''), CAST(t.effectiveness_desired AS NVARCHAR(50)))) IS NOT NULL
             AND TRY_CONVERT(DECIMAL(18,4), COALESCE(NULLIF(LTRIM(RTRIM(t.actual_outcome)), ''), CAST(t.effectiveness_actual AS NVARCHAR(50)))) IS NOT NULL
            THEN TRY_CONVERT(DECIMAL(18,4), COALESCE(NULLIF(LTRIM(RTRIM(t.target_outcome)), ''), CAST(t.effectiveness_desired AS NVARCHAR(50))))
               - TRY_CONVERT(DECIMAL(18,4), COALESCE(NULLIF(LTRIM(RTRIM(t.actual_outcome)), ''), CAST(t.effectiveness_actual AS NVARCHAR(50))))
            ELSE NULL
          END AS outcome_gap,
          t.[year],
          t.responsible_person,
          t.target_date,
          t.Completion_date,
          t.training_location,
          t.employee_id,
          e.emp_name,
          t.effectiveness_desired,
          t.effectiveness_actual,
          t.effectiveness_gap,
          t.gap_fulfilled,
          t.key_learnings,
          t.evidence_file,
          t.created_at
        FROM dbo.Post_training_plan t
        LEFT JOIN dbo.Employees e
          ON t.employee_id = e.emp_code
        WHERE ISNULL(t.IsActive, 1) = 1
          AND (t.crby = @user_id OR t.upby = @user_id)
        ORDER BY t.created_at DESC, t.plan_id DESC
      `);

    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error("POST TRAINING GET ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}

/* ================= POST ================= */
export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await getConnection();
    await ensurePostTrainingColumns(pool);

    const data = await req.formData();
    const fileName = await saveEvidenceFile((data.get("file") as File | null) ?? null);

    const targetOutcome =
      String(data.get("target_outcome") ?? data.get("effectiveness_desired") ?? "").trim();
    const actualOutcome =
      String(data.get("actual_outcome") ?? data.get("effectiveness_actual") ?? "").trim();

    const numericTarget = parseNumericValue(targetOutcome);
    const numericActual = parseNumericValue(actualOutcome);

    const sourcePlanIdRaw = String(data.get("source_plan_id") ?? "").trim();
    const sourcePlanId = sourcePlanIdRaw ? Number(sourcePlanIdRaw) : null;

    await pool.request()
      .input("source_plan_id", sql.Int, Number.isFinite(sourcePlanId ?? NaN) ? sourcePlanId : null)
      .input("plan_desc", sql.NVarChar(500), String(data.get("plan_desc") ?? ""))
      .input(
        "project_skill_names",
        sql.NVarChar(sql.MAX),
        String(data.get("project_skill_names") ?? "").trim() || null,
      )
      .input("target_outcome", sql.NVarChar(200), targetOutcome || null)
      .input("actual_outcome", sql.NVarChar(200), actualOutcome || null)
      .input("year", sql.NVarChar(10), String(data.get("year") ?? ""))
      .input("responsible_person", sql.NVarChar(100), String(data.get("responsible_person") ?? ""))
      .input("target_date", sql.Date, data.get("target_date") || null)
      .input("Completion_date", sql.Date, data.get("Completion_date") || null)
      .input("training_location", sql.NVarChar(50), String(data.get("training_location") ?? ""))
      .input("employee_id", sql.NVarChar(50), String(data.get("employee_id") ?? ""))
      .input("effectiveness_desired", sql.Int, numericTarget)
      .input("effectiveness_actual", sql.Int, numericActual)
      .input(
        "gap_fulfilled",
        sql.Bit,
        String(data.get("gap_fulfilled") ?? "false") === "true",
      )
      .input("key_learnings", sql.NVarChar(500), String(data.get("key_learnings") ?? ""))
      .input("evidence_file", sql.NVarChar(300), fileName)
      .input("crby", sql.NVarChar(50), userId)
      .input("upby", sql.NVarChar(50), userId)
      .query(`
        INSERT INTO dbo.Post_training_plan
        (
          source_plan_id,
          plan_desc,
          project_skill_names,
          target_outcome,
          actual_outcome,
          employee_id,
          [year],
          responsible_person,
          target_date,
          Completion_date,
          training_location,
          effectiveness_desired,
          effectiveness_actual,
          gap_fulfilled,
          key_learnings,
          evidence_file,
          IsActive,
          crby,
          crdt,
          upby,
          updt
        )
        VALUES
        (
          @source_plan_id,
          @plan_desc,
          @project_skill_names,
          @target_outcome,
          @actual_outcome,
          @employee_id,
          @year,
          @responsible_person,
          @target_date,
          @Completion_date,
          @training_location,
          @effectiveness_desired,
          @effectiveness_actual,
          @gap_fulfilled,
          @key_learnings,
          @evidence_file,
          1,
          @crby,
          GETDATE(),
          @upby,
          GETDATE()
        )
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST TRAINING POST ERROR:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ================= PUT ================= */
export async function PUT(req: NextRequest) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await getConnection();
    await ensurePostTrainingColumns(pool);

    const data = await req.formData();
    const rowKey = parseRowKey(String(data.get("row_key") ?? ""));

    if (!rowKey) {
      return NextResponse.json({ error: "Invalid row identifier" }, { status: 400 });
    }

    const currentRecord = await pool.request()
      .input("plan_id", sql.Int, rowKey.recordId)
      .input("employee_id_lookup", sql.NVarChar(50), rowKey.employeeId)
      .input("created_at_lookup", sql.DateTime2, rowKey.createdAt)
      .query(`
        SELECT TOP 1 evidence_file
        FROM dbo.Post_training_plan
        WHERE plan_id = @plan_id
          AND employee_id = @employee_id_lookup
          AND created_at = @created_at_lookup
      `);

    const uploadedFile = (data.get("file") as File | null) ?? null;
    const fileName = uploadedFile
      ? await saveEvidenceFile(uploadedFile)
      : (currentRecord.recordset[0]?.evidence_file as string | null) ?? null;

    const targetOutcome =
      String(data.get("target_outcome") ?? data.get("effectiveness_desired") ?? "").trim();
    const actualOutcome =
      String(data.get("actual_outcome") ?? data.get("effectiveness_actual") ?? "").trim();

    const numericTarget = parseNumericValue(targetOutcome);
    const numericActual = parseNumericValue(actualOutcome);

    const sourcePlanIdRaw = String(data.get("source_plan_id") ?? "").trim();
    const sourcePlanId = sourcePlanIdRaw ? Number(sourcePlanIdRaw) : null;

    await pool.request()
      .input("plan_id", sql.Int, rowKey.recordId)
      .input("employee_id_lookup", sql.NVarChar(50), rowKey.employeeId)
      .input("created_at_lookup", sql.DateTime2, rowKey.createdAt)
      .input("source_plan_id", sql.Int, Number.isFinite(sourcePlanId ?? NaN) ? sourcePlanId : null)
      .input("plan_desc", sql.NVarChar(500), String(data.get("plan_desc") ?? ""))
      .input(
        "project_skill_names",
        sql.NVarChar(sql.MAX),
        String(data.get("project_skill_names") ?? "").trim() || null,
      )
      .input("target_outcome", sql.NVarChar(200), targetOutcome || null)
      .input("actual_outcome", sql.NVarChar(200), actualOutcome || null)
      .input("year", sql.NVarChar(10), String(data.get("year") ?? ""))
      .input("responsible_person", sql.NVarChar(100), String(data.get("responsible_person") ?? ""))
      .input("target_date", sql.Date, data.get("target_date") || null)
      .input("Completion_date", sql.Date, data.get("Completion_date") || null)
      .input("training_location", sql.NVarChar(50), String(data.get("training_location") ?? ""))
      .input("employee_id", sql.NVarChar(50), String(data.get("employee_id") ?? ""))
      .input("effectiveness_desired", sql.Int, numericTarget)
      .input("effectiveness_actual", sql.Int, numericActual)
      .input(
        "gap_fulfilled",
        sql.Bit,
        String(data.get("gap_fulfilled") ?? "false") === "true",
      )
      .input("key_learnings", sql.NVarChar(500), String(data.get("key_learnings") ?? ""))
      .input("evidence_file", sql.NVarChar(300), fileName)
      .input("upby", sql.NVarChar(50), userId)
      .query(`
        UPDATE dbo.Post_training_plan
        SET
          source_plan_id = @source_plan_id,
          plan_desc = @plan_desc,
          project_skill_names = @project_skill_names,
          target_outcome = @target_outcome,
          actual_outcome = @actual_outcome,
          [year] = @year,
          responsible_person = @responsible_person,
          target_date = @target_date,
          Completion_date = @Completion_date,
          training_location = @training_location,
          employee_id = @employee_id,
          effectiveness_desired = @effectiveness_desired,
          effectiveness_actual = @effectiveness_actual,
          gap_fulfilled = @gap_fulfilled,
          key_learnings = @key_learnings,
          evidence_file = @evidence_file,
          upby = @upby,
          updt = GETDATE()
        WHERE plan_id = @plan_id
          AND employee_id = @employee_id_lookup
          AND created_at = @created_at_lookup
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST TRAINING PUT ERROR:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ================= DELETE ================= */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { row_key } = await req.json();
    const rowKey = parseRowKey(String(row_key ?? ""));

    if (!rowKey) {
      return NextResponse.json({ error: "Invalid row identifier" }, { status: 400 });
    }

    const pool = await getConnection();

    await pool.request()
      .input("plan_id", sql.Int, rowKey.recordId)
      .input("employee_id_lookup", sql.NVarChar(50), rowKey.employeeId)
      .input("created_at_lookup", sql.DateTime2, rowKey.createdAt)
      .input("upby", sql.NVarChar(50), userId)
      .query(`
        UPDATE dbo.Post_training_plan
        SET
          IsActive = 0,
          upby = @upby,
          updt = GETDATE()
        WHERE plan_id = @plan_id
          AND employee_id = @employee_id_lookup
          AND created_at = @created_at_lookup
      `);

    return NextResponse.json({ message: "deleted" });
  } catch (error) {
    console.error("POST TRAINING DELETE ERROR:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
