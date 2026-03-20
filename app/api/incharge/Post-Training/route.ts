import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import { getConnection } from "@/lib/dbConnect";

type ParsedRowKey = {
  planId: number;
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

  const fileName = `${Date.now()}_${file.name}`;
  fs.writeFileSync(
    path.join(process.cwd(), "public/evidence", fileName),
    Buffer.from(await file.arrayBuffer()),
  );

  return fileName;
}

function parseRowKey(rowKey: string | null | undefined): ParsedRowKey | null {
  if (!rowKey) {
    return null;
  }

  const [planIdPart, employeeId, createdAt] = rowKey.split("|");
  const planId = Number(planIdPart);

  if (!Number.isFinite(planId) || !employeeId || !createdAt) {
    return null;
  }

  return {
    planId,
    employeeId,
    createdAt,
  };
}

/* ================= GET ================= */
export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await getConnection();
    const result = await pool.request()
    .input("user_id", sql.VarChar(20), userId)
    .query(`
      SELECT
        CONCAT(
          CAST(t.plan_id AS VARCHAR(20)),
          '|',
          ISNULL(t.employee_id, ''),
          '|',
          CONVERT(VARCHAR(33), t.created_at, 126)
        ) AS row_key,
        t.*,
        e.emp_name
      FROM dbo.Post_training_plan t
      LEFT JOIN dbo.Employees e
        ON t.employee_id = e.emp_code
      WHERE t.IsActive = 1
        AND (t.CrBy = @user_id OR t.UpBy = @user_id)
      ORDER BY t.plan_id DESC
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
    const data = await req.formData();
    const fileName = await saveEvidenceFile((data.get("file") as File | null) ?? null);

    await pool.request()
      .input("plan_desc", sql.NVarChar(255), String(data.get("plan_desc") ?? ""))
      .input("year", sql.VarChar(10), String(data.get("year") ?? ""))
      .input(
        "responsible_person",
        sql.NVarChar(150),
        String(data.get("responsible_person") ?? ""),
      )
      .input("target_date", sql.Date, data.get("target_date") || null)
      .input("Completion_date", sql.Date, data.get("Completion_date") || null)
      .input(
        "training_location",
        sql.NVarChar(50),
        String(data.get("training_location") ?? ""),
      )
      .input("employee_id", sql.VarChar(20), String(data.get("employee_id") ?? ""))
      .input(
        "effectiveness_desired",
        sql.Int,
        Number(data.get("effectiveness_desired") ?? 0),
      )
      .input(
        "effectiveness_actual",
        sql.Int,
        Number(data.get("effectiveness_actual") ?? 0),
      )
      .input(
        "gap_fulfilled",
        sql.Bit,
        String(data.get("gap_fulfilled") ?? "false") === "true",
      )
      .input("key_learnings", sql.NVarChar(sql.MAX), String(data.get("key_learnings") ?? ""))
      .input("evidence_file", sql.NVarChar(255), fileName)
      .input("CrBy", sql.VarChar(20), userId)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        INSERT INTO dbo.Post_training_plan
        (
          plan_desc,
          year,
          responsible_person,
          target_date,
          Completion_date,
          training_location,
          employee_id,
          effectiveness_desired,
          effectiveness_actual,
          gap_fulfilled,
          key_learnings,
          evidence_file,
          IsActive,
          CrBy,
          CrDt,
          UpBy,
          UpDt
        )
        VALUES
        (
          @plan_desc,
          @year,
          @responsible_person,
          @target_date,
          @Completion_date,
          @training_location,
          @employee_id,
          @effectiveness_desired,
          @effectiveness_actual,
          @gap_fulfilled,
          @key_learnings,
          @evidence_file,
          1,
          @CrBy,
          GETDATE(),
          @UpBy,
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
    const data = await req.formData();
    const rowKey = parseRowKey(String(data.get("row_key") ?? ""));

    if (!rowKey) {
      return NextResponse.json({ error: "Invalid row identifier" }, { status: 400 });
    }

    const currentRecord = await pool.request()
      .input("plan_id", sql.Int, rowKey.planId)
      .input("employee_id_lookup", sql.VarChar(20), rowKey.employeeId)
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

    await pool.request()
      .input("plan_id", sql.Int, rowKey.planId)
      .input("employee_id_lookup", sql.VarChar(20), rowKey.employeeId)
      .input("created_at_lookup", sql.DateTime2, rowKey.createdAt)
      .input("plan_desc", sql.NVarChar(255), String(data.get("plan_desc") ?? ""))
      .input("year", sql.VarChar(10), String(data.get("year") ?? ""))
      .input(
        "responsible_person",
        sql.NVarChar(150),
        String(data.get("responsible_person") ?? ""),
      )
      .input("target_date", sql.Date, data.get("target_date") || null)
      .input("Completion_date", sql.Date, data.get("Completion_date") || null)
      .input(
        "training_location",
        sql.NVarChar(50),
        String(data.get("training_location") ?? ""),
      )
      .input("employee_id", sql.VarChar(20), String(data.get("employee_id") ?? ""))
      .input(
        "effectiveness_desired",
        sql.Int,
        Number(data.get("effectiveness_desired") ?? 0),
      )
      .input(
        "effectiveness_actual",
        sql.Int,
        Number(data.get("effectiveness_actual") ?? 0),
      )
      .input(
        "gap_fulfilled",
        sql.Bit,
        String(data.get("gap_fulfilled") ?? "false") === "true",
      )
      .input("key_learnings", sql.NVarChar(sql.MAX), String(data.get("key_learnings") ?? ""))
      .input("evidence_file", sql.NVarChar(255), fileName)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        UPDATE dbo.Post_training_plan
        SET
          plan_desc = @plan_desc,
          year = @year,
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
          UpBy = @UpBy,
          UpDt = GETDATE()
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
      .input("plan_id", sql.Int, rowKey.planId)
      .input("employee_id_lookup", sql.VarChar(20), rowKey.employeeId)
      .input("created_at_lookup", sql.DateTime2, rowKey.createdAt)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        UPDATE dbo.Post_training_plan
        SET
          IsActive = 0,
          UpBy = @UpBy,
          UpDt = GETDATE()
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
