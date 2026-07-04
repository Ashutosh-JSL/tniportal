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

async function isTrainingPlanStatusBit(pool: sql.ConnectionPool) {
  const result = await pool.request().query(`
    SELECT TOP 1 t.name AS data_type
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.TrainingPlan')
      AND c.name = 'status'
  `);

  return result.recordset[0]?.data_type === "bit";
}

function inputTrainingPlanStatus(
  request: sql.Request,
  isBitStatus: boolean,
  status: "Pending" | "Approved" | "Rejected",
) {
  if (isBitStatus) {
    request.input("status", sql.Bit, status === "Rejected" ? 0 : 1);
    return request;
  }

  request.input("status", sql.NVarChar(20), status);
  return request;
}

/* ===================== GET ===================== */
export async function GET() {
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
        COALESCE(TP.Skill_Area_Id, tpm.skill_area_id) AS skill_area_id,
        sa.SKILL_AREA AS skill_area_name,
        ISNULL(TP.plan_type, 'Training') AS plan_type,
        TP.project_skill_names,
        TP.year,
        TP.responsible_person,
        TP.target_date,
        TP.training_location,
        TP.CrBy AS requested_by,
        TP.UpBy AS requested_by_name,
        CASE
          WHEN CONVERT(NVARCHAR(20), TP.status) = 'Approved' THEN 'Approved'
          WHEN CONVERT(NVARCHAR(20), TP.status) = 'Rejected' THEN 'Rejected'
          WHEN CONVERT(NVARCHAR(20), TP.status) = '0' THEN 'Rejected'
          WHEN CONVERT(NVARCHAR(20), TP.status) = '1' AND TP.reviewed_at IS NOT NULL THEN 'Approved'
          ELSE 'Pending'
        END AS status,
        TP.created_at AS requested_at,
        TP.reviewed_by,
        (SELECT TOP 1 emp_name FROM dbo.Employees WHERE emp_code = TP.reviewed_by) AS reviewed_by_name,
        TP.reviewed_at
      FROM dbo.TrainingPlan TP
      INNER JOIN dbo.Employees E ON TP.employee_id = E.emp_code
      LEFT JOIN dbo.TrainingPlanMaster tpm
        ON tpm.plan_master_id = TP.plan_master_id
      LEFT JOIN dbo.SKILL_AREA sa
        ON sa.ID = COALESCE(TP.Skill_Area_Id, tpm.skill_area_id)
      WHERE TP.IsActive = 1
        AND CONVERT(NVARCHAR(20), TP.status) IN ('Pending', 'Approved', 'Rejected', '0', '1')
      ORDER BY
        CASE
          WHEN CONVERT(NVARCHAR(20), TP.status) IN ('Pending', '1') AND TP.reviewed_at IS NULL THEN 0
          ELSE 1
        END,
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
    const isBitStatus = await isTrainingPlanStatusBit(pool);
    const updatedBy = String(currentUser.employeeCode ?? currentUser.username ?? "").slice(0, 20);

    // Use a transaction for bulk update
    const transaction = await pool.transaction();
    try {
      await transaction.begin();
      const request = transaction.request();

      // Build the query with IN clause
      const placeholders = records.map((_: any, i: number) => `@id_${i}`).join(", ");
      records.forEach((record: any, index: number) => {
        request.input(`id_${index}`, sql.Int, Number(record.plan_id));
      });
      inputTrainingPlanStatus(request, isBitStatus, "Pending");
      request.input("upby", sql.VarChar(20), updatedBy);

      await request.query(`
        UPDATE dbo.TrainingPlan
        SET status = @status,
            UpBy = @upby,
            UpDt = GETDATE()
        WHERE plan_id IN (${placeholders})
      `);

      await transaction.commit();

      return NextResponse.json({ success: true, submittedCount: records.length });
    } catch (error) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Transaction rollback failed:", rollbackError);
      }
      throw error;
    }
  } catch (error) {
    console.error("TRAINING PLAN AUTH POST ERROR:", error);
    const message = error instanceof Error ? error.message : "Failed to submit authorization request";
    return NextResponse.json(
      { error: message },
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

    const { id, action, ids } = await req.json();
    const status =
      action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "";

    if (!status) {
      return NextResponse.json(
        { error: "Invalid review request" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensureTrainingPlanSchema(pool);
    const isBitStatus = await isTrainingPlanStatusBit(pool);

    // Handle bulk operations
    if (Array.isArray(ids) && ids.length > 0) {
      const transaction = await pool.transaction();
      try {
        await transaction.begin();
        const request = transaction.request();

        // Build the query with IN clause
        const placeholders = ids.map((_: any, i: number) => `@id_${i}`).join(", ");
        ids.forEach((idVal: number, index: number) => {
          request.input(`id_${index}`, sql.Int, idVal);
        });
        inputTrainingPlanStatus(request, isBitStatus, status);
        request.input("reviewed_by", sql.VarChar(20), String(currentUser.employeeCode ?? ""));
        request.input("reviewed_at", sql.DateTime, new Date());

        await request.query(`
          UPDATE dbo.TrainingPlan
          SET
            status = @status,
            reviewed_by = @reviewed_by,
            reviewed_at = @reviewed_at
          WHERE plan_id IN (${placeholders})
        `);

        await transaction.commit();

        return NextResponse.json({ success: true, updatedCount: ids.length });
      } catch (error) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error("Transaction rollback failed:", rollbackError);
        }
        throw error;
      }
    }

    // Handle single item operation (legacy)
    if (!id || !status) {
      return NextResponse.json(
        { error: "Invalid review request" },
        { status: 400 },
      );
    }

    const request = pool.request();
    inputTrainingPlanStatus(request, isBitStatus, status);

    await request
      .input("plan_id", sql.Int, Number(id))
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
