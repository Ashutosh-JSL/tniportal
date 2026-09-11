import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import { getConnection } from "@/lib/dbConnect";
import { v4 as uuidv4 } from "uuid";

// ============================================
// SECURITY CONFIGURATION
// ============================================

// Files will be stored OUTSIDE the web root
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const PUBLIC_DIR = path.join(process.cwd(), "public");

// Allowlist of permitted file extensions (case-insensitive)
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".sql",
]);

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================
// UTILITY FUNCTIONS
// ============================================

type SessionUser = {
  id?: string;
  employeeCode?: string;
  roles?: string[];
};

async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return String(user?.employeeCode ?? user?.id ?? "").trim();
}

async function getUserRoles() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return user?.roles ?? [];
}

/**
 * Validate file content by checking magic bytes (file signatures)
 * This prevents attackers from simply renaming .html to .jpg
 */
function validateFileSignature(mimeType: string, buffer: Buffer): boolean {
  // Magic bytes for image types
  switch (mimeType) {
    case "image/png":
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      return buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;

    case "image/jpeg":
      // JPEG: FF D8 FF
      return buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff;

    case "image/gif":
      // GIF: 47 49 46 38 (GIF8)
      return buffer.length >= 4 &&
        buffer[0] === 0x47 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x38;

    case "image/webp":
      // WebP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
      if (buffer.length < 12) return false;
      return buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50;

    case "application/pdf":
      // PDF: 25 50 44 46 (%PDF)
      return buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46;

    case "text/plain":
    case "text/csv":
    case "application/sql":
      // Text files - already validated by determineMimeType
      return true;

    case "application/msword":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.ms-excel":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      // Office documents - check for file header
      return buffer.length >= 2 &&
        ((buffer[0] === 0xd0 && buffer[1] === 0xcf) || // DOC/ xls (OLE2)
         (buffer[0] === 0x50 && buffer[1] === 0x4b)); // DOCX/ xlsx (ZIP)

    default:
      return false;
  }
}

/**
 * Safely extract file extension and validate it
 */
function sanitizeAndValidateExtension(originalName: string): { valid: boolean; extension: string; error?: string } {
  const normalizedPath = originalName.replace(/\\/g, "/");
  const lastSlash = normalizedPath.lastIndexOf("/");
  const filename = lastSlash === -1 ? normalizedPath : normalizedPath.substring(lastSlash + 1);

  // Check for path traversal (prevent ../ or ..\\)
  if (filename.includes("..") || normalizedPath.includes("..")) {
    return { valid: false, extension: "", error: "Invalid filename: path traversal detected" };
  }

  // Check for null bytes
  if (filename.includes("\0")) {
    return { valid: false, extension: "", error: "Invalid filename: null byte detected" };
  }

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) {
    return { valid: false, extension: "", error: "File is missing an extension" };
  }

  const extension = filename.substring(dotIndex).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return {
      valid: false,
      extension: "",
      error: `File type not allowed. Allowed types: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`,
    };
  }

  return { valid: true, extension };
}

/**
 * Determine MIME type based on file signature, not user-provided type
 */
function determineMimeType(buffer: Buffer): string | null {
  // Check PNG (magic bytes: 89 50 4E 47 0D 0A 1A 0A)
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  // Check JPEG (magic bytes: FF D8 FF)
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  // Check GIF (magic bytes: 47 49 46 38 37 61 or 47 49 46 38 39 61)
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return "image/gif";
  }
  // Check WebP (RIFF....WEBP - magic bytes: 52 49 46 46)
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return "image/webp";
    }
  }
  // Check PDF (magic bytes: 25 50 44 46)
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return "application/pdf";
  }

  // If it's text-based, check for dangerous content
  if (buffer.length > 0) {
    let isText = true;
    for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
      const byte = buffer[i];
      // Allow: newline(0x0a), tab(0x09), carriage return(0x0d), space(0x20), printable ASCII
      if (
        byte !== 0x0a &&
        byte !== 0x09 &&
        byte !== 0x0d &&
        byte !== 0x20 &&
        (byte < 0x20 || byte > 0x7e)
      ) {
        isText = false;
        break;
      }
    }
    if (isText) {
      // Check if it's HTML/JS (dangerous for upload)
      const sample = buffer.slice(0, 4096).toString("utf-8").toLowerCase();
      if (
        sample.includes("<html") ||
        sample.includes("<script") ||
        sample.includes("javascript:") ||
        sample.includes("onload=") ||
        sample.includes("onerror=") ||
        sample.includes("<svg")
      ) {
        return null; // Reject HTML/JS content
      }
      return "text/plain";
    }
  }

  return null;
}

/**
 * Validate file type based on both extension and content
 * This runs on the server side for security
 */
async function validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds 10MB limit. Size: ${Math.round(file.size / 1024)}KB` };
  }

  // Check for empty file
  if (file.size === 0) {
    return { valid: false, error: "Empty files are not allowed" };
  }

  // Validate extension first
  const extValidation = sanitizeAndValidateExtension(file.name);
  if (!extValidation.valid) {
    return { valid: false, error: extValidation.error };
  }

  // Read file buffer for content validation
  const buffer = Buffer.from(await file.arrayBuffer());

  // Determine MIME type from magic bytes
  const mimeType = determineMimeType(buffer);

  if (!mimeType) {
    return { valid: false, error: "File content validation failed: unsupported file type" };
  }

  // Verify the file signature matches the extension
  if (!validateFileSignature(mimeType, buffer)) {
    return { valid: false, error: "File content does not match the file extension" };
  }

  return { valid: true };
}

/**
 * Generate a secure, unpredictable filename
 * Never use the original filename for storage
 */
function generateSecureFileName(originalExtension: string): string {
  const timestamp = Date.now();
  const uuid = uuidv4().replace(/-/g, "");
  const randomChars = Math.random().toString(36).substring(2, 8);
  return `${timestamp}_${randomChars}${originalExtension}`;
}

/**
 * Save uploaded file to secure location
 */
async function saveEvidenceFile(file: File | null): Promise<string | null> {
  if (!file) {
    return null;
  }

  // Validate the file
  const validation = await validateFile(file);
  if (!validation.valid) {
    console.warn(`File upload rejected: ${validation.error}`);
    throw new Error(validation.error || "Invalid file upload");
  }

  // Extract and validate extension
  const extValidation = sanitizeAndValidateExtension(file.name);
  if (!extValidation.valid) {
    throw new Error(extValidation.error);
  }

  // Generate secure filename
  const fileName = generateSecureFileName(extValidation.extension);

  // Ensure uploads directory exists
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  // Write file to secure location (outside app directory)
  fs.writeFileSync(
    path.join(UPLOADS_DIR, fileName),
    Buffer.from(await file.arrayBuffer()),
  );

  return fileName;
}

/**
 * Get file info for download
 */
async function getFileFileInfo(fileName: string): Promise<{ path: string; mimeType: string } | null> {
  // Validate filename
  const extValidation = sanitizeAndValidateExtension(fileName);
  if (!extValidation.valid) {
    return null;
  }

  const filePath = path.join(UPLOADS_DIR, fileName);

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    // Read first bytes to determine MIME type
    const fileHandle = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(16);
    fs.readSync(fileHandle, buffer, 0, 16, 0);
    fs.closeSync(fileHandle);
    let mimeType = extValidation.extension === ".txt" ? "text/plain" : "application/octet-stream";

    if (extValidation.extension === ".pdf") mimeType = "application/pdf";
    else if (extValidation.extension === ".png") mimeType = "image/png";
    else if (extValidation.extension === ".jpg" || extValidation.extension === ".jpeg") mimeType = "image/jpeg";
    else if (extValidation.extension === ".gif") mimeType = "image/gif";
    else if (extValidation.extension === ".webp") mimeType = "image/webp";
    else if (extValidation.extension === ".doc") mimeType = "application/msword";
    else if (extValidation.extension === ".docx") mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (extValidation.extension === ".xls") mimeType = "application/vnd.ms-excel";
    else if (extValidation.extension === ".xlsx") mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else if (extValidation.extension === ".csv") mimeType = "text/csv";

    return { path: filePath, mimeType };
  } catch {
    return null;
  }
}

// ============================================
// SCHEMA MANAGEMENT
// ============================================

type ParsedRowKey = {
  recordId: number;
  employeeId: string;
  createdAt: string;
};

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

    IF COL_LENGTH('dbo.Post_training_plan', 'outcome_id') IS NULL
      ALTER TABLE dbo.Post_training_plan ADD outcome_id INT NULL
  `);
}

// ============================================
// API ROUTES
// ============================================

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
          COALESCE(tp.Skill_Area_Id, tpm.skill_area_id) AS skill_area_id,
          sa.SKILL_AREA AS skill_area_name,
          t.outcome_id,
          COALESCE(tomo.outcome_name, COALESCE(NULLIF(LTRIM(RTRIM(t.target_outcome)), ''), CASE WHEN t.effectiveness_desired IS NULL THEN NULL ELSE CAST(t.effectiveness_desired AS NVARCHAR(50)) END)) AS target_outcome,
          COALESCE(tomo_act.outcome_name, COALESCE(NULLIF(LTRIM(RTRIM(t.actual_outcome)), ''), CASE WHEN t.effectiveness_actual IS NULL THEN NULL ELSE CAST(t.effectiveness_actual AS NVARCHAR(50)) END)) AS actual_outcome,
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
        LEFT JOIN dbo.TrainingPlan tp
          ON tp.plan_id = t.source_plan_id
        LEFT JOIN dbo.TrainingPlanMaster tpm
          ON tpm.plan_master_id = tp.plan_master_id
        LEFT JOIN dbo.SKILL_AREA sa
          ON sa.ID = COALESCE(tp.Skill_Area_Id, tpm.skill_area_id)
        LEFT JOIN dbo.mst_training_outcome tomo
          ON tomo.outcome_rating = TRY_CONVERT(INT, t.target_outcome)
        LEFT JOIN dbo.mst_training_outcome tomo_act
          ON tomo_act.outcome_rating = TRY_CONVERT(INT, t.actual_outcome)
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

    // Verify user is Incharge or has upload privilege
    const roles = await getUserRoles();
    if (!roles.includes("Incharge") && !roles.includes("Admin")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const pool = await getConnection();
    await ensurePostTrainingColumns(pool);

    const data = await req.formData();
    const file = (data.get("file") as File | null) ?? null;

    // Validate file upload
    let fileName: string | null = null;
    if (file) {
      try {
        fileName = await saveEvidenceFile(file);
      } catch (error: any) {
        return NextResponse.json({ error: error.message || "File validation failed" }, { status: 400 });
      }
    }

    const targetOutcome =
      String(data.get("target_outcome") ?? data.get("effectiveness_desired") ?? "").trim();
    const actualOutcome =
      String(data.get("actual_outcome") ?? data.get("effectiveness_actual") ?? "").trim();

    const numericTarget = parseNumericValue(targetOutcome);
    const numericActual = parseNumericValue(actualOutcome);

    const sourcePlanIdRaw = String(data.get("source_plan_id") ?? "").trim();
    const sourcePlanId = sourcePlanIdRaw ? Number(sourcePlanIdRaw) : null;

    const outcomeIdRaw = String(data.get("outcome_id") ?? "").trim();
    const outcomeId = outcomeIdRaw ? Number(outcomeIdRaw) : null;

    await pool.request()
      .input("source_plan_id", sql.Int, Number.isFinite(sourcePlanId ?? NaN) ? sourcePlanId : null)
      .input("plan_desc", sql.NVarChar(500), String(data.get("plan_desc") ?? "").trim())
      .input(
        "project_skill_names",
        sql.NVarChar(sql.MAX),
        String(data.get("project_skill_names") ?? "").trim() || null,
      )
      .input("target_outcome", sql.NVarChar(200), targetOutcome || null)
      .input("actual_outcome", sql.NVarChar(200), actualOutcome || null)
      .input("outcome_id", sql.Int, outcomeId)
      .input("year", sql.NVarChar(10), String(data.get("year") ?? "").trim())
      .input("responsible_person", sql.NVarChar(100), String(data.get("responsible_person") ?? "").trim())
      .input("target_date", sql.Date, data.get("target_date") || null)
      .input("Completion_date", sql.Date, data.get("Completion_date") || null)
      .input("training_location", sql.NVarChar(50), String(data.get("training_location") ?? "").trim())
      .input("employee_id", sql.NVarChar(50), String(data.get("employee_id") ?? "").trim())
      .input("effectiveness_desired", sql.Int, numericTarget)
      .input("effectiveness_actual", sql.Int, numericActual)
      .input(
        "gap_fulfilled",
        sql.Bit,
        String(data.get("gap_fulfilled") ?? "false") === "true",
      )
      .input("key_learnings", sql.NVarChar(500), String(data.get("key_learnings") ?? "").trim())
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
          outcome_id,
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
          @outcome_id,
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

    const roles = await getUserRoles();
    if (!roles.includes("Incharge") && !roles.includes("Admin")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const pool = await getConnection();
    await ensurePostTrainingColumns(pool);

    const data = await req.formData();
    const rowKey = parseRowKey(String(data.get("row_key") ?? ""));

    if (!rowKey) {
      return NextResponse.json({ error: "Invalid row identifier" }, { status: 400 });
    }

    // Authorization check: user must own the record
    const ownershipCheck = await pool.request()
      .input("plan_id", sql.Int, rowKey.recordId)
      .input("employee_id_lookup", sql.NVarChar(50), rowKey.employeeId)
      .input("created_at_lookup", sql.DateTime2, rowKey.createdAt)
      .query(`
        SELECT TOP 1 crby, upby
        FROM dbo.Post_training_plan
        WHERE plan_id = @plan_id
          AND employee_id = @employee_id_lookup
          AND created_at = @created_at_lookup
      `);

    if (ownershipCheck.recordset.length === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const recordOwner = ownershipCheck.recordset[0];
    if (recordOwner.crby !== userId && recordOwner.upby !== userId) {
      return NextResponse.json({ error: "You can only edit your own records" }, { status: 403 });
    }

    // Handle file upload
    const uploadedFile = (data.get("file") as File | null) ?? null;
    let fileName: string | null = null;

    if (uploadedFile) {
      try {
        fileName = await saveEvidenceFile(uploadedFile);
      } catch (error: any) {
        return NextResponse.json({ error: error.message || "File validation failed" }, { status: 400 });
      }
    } else {
      // Keep existing file if no new upload
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

      fileName = currentRecord.recordset[0]?.evidence_file as string | null;
    }

    const targetOutcome =
      String(data.get("target_outcome") ?? data.get("effectiveness_desired") ?? "").trim();
    const actualOutcome =
      String(data.get("actual_outcome") ?? data.get("effectiveness_actual") ?? "").trim();

    const numericTarget = parseNumericValue(targetOutcome);
    const numericActual = parseNumericValue(actualOutcome);

    const sourcePlanIdRaw = String(data.get("source_plan_id") ?? "").trim();
    const sourcePlanId = sourcePlanIdRaw ? Number(sourcePlanIdRaw) : null;

    const outcomeIdRaw = String(data.get("outcome_id") ?? "").trim();
    const outcomeId = outcomeIdRaw ? Number(outcomeIdRaw) : null;

    await pool.request()
      .input("plan_id", sql.Int, rowKey.recordId)
      .input("employee_id_lookup", sql.NVarChar(50), rowKey.employeeId)
      .input("created_at_lookup", sql.DateTime2, rowKey.createdAt)
      .input("source_plan_id", sql.Int, Number.isFinite(sourcePlanId ?? NaN) ? sourcePlanId : null)
      .input("plan_desc", sql.NVarChar(500), String(data.get("plan_desc") ?? "").trim())
      .input(
        "project_skill_names",
        sql.NVarChar(sql.MAX),
        String(data.get("project_skill_names") ?? "").trim() || null,
      )
      .input("target_outcome", sql.NVarChar(200), targetOutcome || null)
      .input("actual_outcome", sql.NVarChar(200), actualOutcome || null)
      .input("outcome_id", sql.Int, outcomeId)
      .input("year", sql.NVarChar(10), String(data.get("year") ?? "").trim())
      .input("responsible_person", sql.NVarChar(100), String(data.get("responsible_person") ?? "").trim())
      .input("target_date", sql.Date, data.get("target_date") || null)
      .input("Completion_date", sql.Date, data.get("Completion_date") || null)
      .input("training_location", sql.NVarChar(50), String(data.get("training_location") ?? "").trim())
      .input("employee_id", sql.NVarChar(50), String(data.get("employee_id") ?? "").trim())
      .input("effectiveness_desired", sql.Int, numericTarget)
      .input("effectiveness_actual", sql.Int, numericActual)
      .input(
        "gap_fulfilled",
        sql.Bit,
        String(data.get("gap_fulfilled") ?? "false") === "true",
      )
      .input("key_learnings", sql.NVarChar(500), String(data.get("key_learnings") ?? "").trim())
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
          outcome_id = @outcome_id,
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

    // Authorization check: only owner can delete
    const ownershipCheck = await pool.request()
      .input("plan_id", sql.Int, rowKey.recordId)
      .input("employee_id_lookup", sql.NVarChar(50), rowKey.employeeId)
      .input("created_at_lookup", sql.DateTime2, rowKey.createdAt)
      .query(`
        SELECT TOP 1 crby, upby
        FROM dbo.Post_training_plan
        WHERE plan_id = @plan_id
          AND employee_id = @employee_id_lookup
          AND created_at = @created_at_lookup
          AND ISNULL(IsActive, 1) = 1
      `);

    if (ownershipCheck.recordset.length === 0) {
      return NextResponse.json({ error: "Record not found or already deleted" }, { status: 404 });
    }

    const recordOwner = ownershipCheck.recordset[0];
    if (recordOwner.crby !== userId && recordOwner.upby !== userId) {
      return NextResponse.json({ error: "You can only delete your own records" }, { status: 403 });
    }

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
