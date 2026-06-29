import { NextResponse } from "next/server";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";

type SessionUser = {
  roles?: string[];
};

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

async function ensurePlanMasterApprovalColumn(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF COL_LENGTH('dbo.TrainingPlanMaster', 'approval_status') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlanMaster
      ADD approval_status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_TrainingPlanMaster_approval_status DEFAULT 'Approved'
        WITH VALUES
    END

    IF COL_LENGTH('dbo.TrainingPlanMaster', 'skill_area_id') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlanMaster
      ADD skill_area_id INT NULL
    END
  `);
}

async function isAdminUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return user?.roles?.includes("Admin") ?? false;
}

/* ================= GET ================= */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeAll = searchParams.get("includeAll") === "true";
    const skillAreaId = searchParams.get("skill_area_id");
    const pool = await sql.connect(config);
    await ensurePlanMasterApprovalColumn(pool);

    let query = `
      SELECT
        tpm.plan_master_id,
        tpm.plan_Heading,
        tpm.plan_Desc,
        tpm.approval_status,
        tpm.created_at,
        tpm.skill_area_id,
        sa.SKILL_AREA AS skill_area_name
      FROM dbo.TrainingPlanMaster tpm
      LEFT JOIN dbo.SKILL_AREA sa ON sa.ID = tpm.skill_area_id
      WHERE @includeAll = 1 OR tpm.approval_status = 'Approved'
    `;

    const request = pool.request().input("includeAll", sql.Bit, includeAll);

    if (skillAreaId && skillAreaId !== "null" && skillAreaId !== "") {
      query += ` AND tpm.skill_area_id = @skill_area_id`;
      request.input("skill_area_id", sql.Int, Number(skillAreaId));
    }

    query += ` ORDER BY tpm.plan_master_id DESC`;

    const result = await request.query(query);

    return NextResponse.json(result.recordset, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json([], { status: 500 });
  }
}

/* ================= POST ================= */
export async function POST(req: Request) {
  try {
    const { plan_Heading, plan_Desc, skill_area_id } = await req.json();
    const heading = String(plan_Heading ?? "").trim();
    const description = String(plan_Desc ?? "").trim();
    const skillAreaId = skill_area_id ? Number(skill_area_id) : null;

    if (!heading) {
      return NextResponse.json(
        { error: "Plan heading required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensurePlanMasterApprovalColumn(pool);

    // Validate skill area if provided
    if (skillAreaId !== null) {
      const areaResult = await pool.request()
        .input("skill_area_id", sql.Int, skillAreaId)
        .query(`
          SELECT TOP 1 ID
          FROM dbo.SKILL_AREA
          WHERE ID = @skill_area_id
            AND (IsActive = 1 OR IsActive IS NULL)
        `);
      if (areaResult.recordset.length === 0) {
        return NextResponse.json(
          { error: "Selected skill area is invalid or inactive" },
          { status: 400 },
        );
      }
    }

    await pool.request()
      .input("plan_Heading", sql.NVarChar(500), heading)
      .input("plan_Desc", sql.VarChar(255), description || null)
      .input("skill_area_id", sql.Int, skillAreaId)
      .query(`
        INSERT INTO dbo.TrainingPlanMaster
        (plan_Heading, plan_Desc, approval_status, skill_area_id)
        VALUES (@plan_Heading, @plan_Desc, 'Pending', @skill_area_id)
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Insert failed" },
      { status: 500 },
    );
  }
}

/* ================= PUT ================= */
export async function PUT(req: Request) {
  try {
    const { plan_master_id, plan_Heading, plan_Desc, skill_area_id } = await req.json();
    const heading = String(plan_Heading ?? "").trim();
    const description = String(plan_Desc ?? "").trim();
    const skillAreaId = skill_area_id ? Number(skill_area_id) : null;

    if (!plan_master_id || !heading) {
      return NextResponse.json(
        { error: "Plan id and heading are required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensurePlanMasterApprovalColumn(pool);

    // Validate skill area if provided
    if (skillAreaId !== null) {
      const areaResult = await pool.request()
        .input("skill_area_id", sql.Int, skillAreaId)
        .query(`
          SELECT TOP 1 ID
          FROM dbo.SKILL_AREA
          WHERE ID = @skill_area_id
            AND (IsActive = 1 OR IsActive IS NULL)
        `);
      if (areaResult.recordset.length === 0) {
        return NextResponse.json(
          { error: "Selected skill area is invalid or inactive" },
          { status: 400 },
        );
      }
    }

    await pool.request()
      .input("plan_master_id", sql.Int, Number(plan_master_id))
      .input("plan_Heading", sql.NVarChar(500), heading)
      .input("plan_Desc", sql.VarChar(255), description || null)
      .input("skill_area_id", sql.Int, skillAreaId)
      .query(`
        UPDATE dbo.TrainingPlanMaster
        SET
          plan_Heading = @plan_Heading,
          plan_Desc = @plan_Desc,
          skill_area_id = @skill_area_id,
          approval_status = CASE
            WHEN approval_status = 'Approved' THEN approval_status
            ELSE 'Pending'
          END
        WHERE plan_master_id = @plan_master_id
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 },
    );
  }
}

/* ================= DELETE ================= */
export async function DELETE(req: Request) {
  try {
    const { plan_master_id } = await req.json();

    if (!plan_master_id) {
      return NextResponse.json(
        { error: "Plan id required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensurePlanMasterApprovalColumn(pool);

    await pool.request()
      .input("plan_master_id", sql.Int, Number(plan_master_id))
      .query(`DELETE FROM dbo.TrainingPlanMaster WHERE plan_master_id = @plan_master_id`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 },
    );
  }
}

/* ================= PATCH APPROVAL ================= */
export async function PATCH(req: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json(
        { error: "Only admin users can approve or reject training plans" },
        { status: 403 },
      );
    }

    const { plan_master_id, action } = await req.json();
    const status =
      action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "";

    if (!plan_master_id || !status) {
      return NextResponse.json(
        { error: "Plan id and valid action are required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensurePlanMasterApprovalColumn(pool);

    await pool.request()
      .input("plan_master_id", sql.Int, Number(plan_master_id))
      .input("approval_status", sql.NVarChar(20), status)
      .query(`
        UPDATE dbo.TrainingPlanMaster
        SET approval_status = @approval_status
        WHERE plan_master_id = @plan_master_id
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Approval update failed" },
      { status: 500 },
    );
  }
}
