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

async function ensureSkillApprovalColumn(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF COL_LENGTH('dbo.Skills', 'approval_status') IS NULL
    BEGIN
      ALTER TABLE dbo.Skills
      ADD approval_status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Skills_approval_status DEFAULT 'Approved'
        WITH VALUES
    END

    IF COL_LENGTH('dbo.Skills', 'SKILL_AREA_ID') IS NULL
    BEGIN
      ALTER TABLE dbo.Skills
      ADD SKILL_AREA_ID INT NULL
    END
  `);
}

async function isAdminUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return user?.roles?.includes("Admin") ?? false;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeAll = searchParams.get("includeAll") === "true";
    const includeAreas = searchParams.get("includeAreas") === "true";
    const pool = await sql.connect(config);
    await ensureSkillApprovalColumn(pool);

    const result = await pool.request()
      .input("includeAll", sql.Bit, includeAll)
      .query(`
      SELECT
        s.skill_id,
        s.skill_name,
        s.approval_status,
        s.SKILL_AREA_ID AS skill_area_id,
        sa.SKILL_AREA AS skill_area
      FROM dbo.Skills s
      LEFT JOIN dbo.SKILL_AREA sa
        ON sa.ID = s.SKILL_AREA_ID
      WHERE (@includeAll = 1 OR s.approval_status = 'Approved')
        AND (s.IsActive = 1 OR s.IsActive IS NULL)
      ORDER BY s.skill_name
    `);

    if (!includeAreas) {
      return NextResponse.json(result.recordset);
    }

    const areaResult = await pool.request().query(`
      SELECT
        ID AS id,
        SKILL_AREA AS skill_area
      FROM dbo.SKILL_AREA
      WHERE IsActive = 1 OR IsActive IS NULL
      ORDER BY SKILL_AREA
    `);

    return NextResponse.json({
      skills: result.recordset,
      skillAreas: areaResult.recordset,
    });
  } catch (error) {
    console.error("SKILL MASTER GET ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}
export async function POST(req: Request) {
  try {
    const { skill_name, skill_area_id } = await req.json();
    const normalizedSkill = String(skill_name ?? "").trim();
    const skillAreaId = Number(skill_area_id);

    if (!normalizedSkill || !Number.isFinite(skillAreaId)) {
      return NextResponse.json(
        { error: "Skill name and skill area are required" },
        { status: 400 },
      );
    }
    const pool = await sql.connect(config);
    await ensureSkillApprovalColumn(pool);

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

    await pool.request()
      .input("skill_name", sql.VarChar(100), normalizedSkill)
      .input("skill_area_id", sql.Int, skillAreaId)
      .query(`
        INSERT INTO dbo.Skills (skill_name, SKILL_AREA_ID, approval_status)
        VALUES (@skill_name, @skill_area_id, 'Pending')
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SKILL MASTER POST ERROR:", error);
    return NextResponse.json(
      { error: "Insert failed" },
      { status: 500 },
    );
  }
}
export async function PUT(req: Request) {
  try {
    const { skill_id, skill_name, skill_area_id } = await req.json();
    const normalizedSkill = String(skill_name ?? "").trim();
    const skillAreaId = Number(skill_area_id);

    if (!skill_id || !normalizedSkill || !Number.isFinite(skillAreaId)) {
      return NextResponse.json(
        { error: "Skill id, skill name, and skill area are required" },
        { status: 400 },
      );
    }
    const pool = await sql.connect(config);
    await ensureSkillApprovalColumn(pool);

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

    await pool.request()
      .input("skill_id", sql.Int, Number(skill_id))
      .input("skill_name", sql.VarChar(100), normalizedSkill)
      .input("skill_area_id", sql.Int, skillAreaId)
      .query(`
        UPDATE dbo.Skills
        SET
          skill_name = @skill_name,
          SKILL_AREA_ID = @skill_area_id,
          approval_status = CASE
            WHEN approval_status = 'Approved' THEN approval_status
            ELSE 'Pending'
          END
        WHERE skill_id = @skill_id
      `);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SKILL MASTER PUT ERROR:", error);
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 },
    );
  }
}
export async function DELETE(req: Request) {
  try {
    const { skill_id } = await req.json();

    if (!skill_id) {
      return NextResponse.json(
        { error: "Skill id required" },
        { status: 400 },
      );
    }
    const pool = await sql.connect(config);
    await ensureSkillApprovalColumn(pool);

    await pool.request()
      .input("skill_id", sql.Int, Number(skill_id))
      .query(`DELETE FROM dbo.Skills WHERE skill_id = @skill_id`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SKILL MASTER DELETE ERROR:", error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    if (!(await isAdminUser())) {
      return NextResponse.json(
        { error: "Only admin users can approve or reject skills" },
        { status: 403 },
      );
    }

    const { skill_id, action } = await req.json();
    const status =
      action === "approve" ? "Approved" : action === "reject" ? "Rejected" : "";

    if (!skill_id || !status) {
      return NextResponse.json(
        { error: "Skill id and valid action are required" },
        { status: 400 },
      );
    }

    const pool = await sql.connect(config);
    await ensureSkillApprovalColumn(pool);

    await pool.request()
      .input("skill_id", sql.Int, Number(skill_id))
      .input("approval_status", sql.NVarChar(20), status)
      .query(`
        UPDATE dbo.Skills
        SET approval_status = @approval_status
        WHERE skill_id = @skill_id
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SKILL MASTER PATCH ERROR:", error);
    return NextResponse.json(
      { error: "Approval update failed" },
      { status: 500 },
    );
  }
}
