import { NextResponse } from "next/server";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";

type SessionUser = {
  id?: string;
  employeeCode?: string;
};

async function getSessionUserId() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return user?.employeeCode ?? user?.id ?? null;
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

async function ensureSkillApprovalColumn(pool: sql.ConnectionPool) {
  await pool.request().query(`
    IF COL_LENGTH('dbo.Skills', 'approval_status') IS NULL
    BEGIN
      ALTER TABLE dbo.Skills
      ADD approval_status NVARCHAR(20) NOT NULL
        CONSTRAINT DF_Skills_approval_status DEFAULT 'Approved'
        WITH VALUES
    END

    IF COL_LENGTH('dbo.TrainingPlanSkills', 'skill_area_id') IS NULL
    BEGIN
      ALTER TABLE dbo.TrainingPlanSkills
      ADD skill_area_id INT NULL
    END
  `);
}

/* ===================== GET ===================== */
export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await sql.connect(config);
    await ensureSkillApprovalColumn(pool);

    const employees = await pool.request()
    .input("user_id", sql.VarChar(20), userId)
    .query(`
      SELECT
        emp_code,
        emp_name
      FROM dbo.Employees
      WHERE (IsActive = 1 OR IsActive IS NULL)
        AND (CrBy = @user_id OR UpBy = @user_id)
      ORDER BY emp_name
    `);

    const records = await pool.request()
    .input("crby", sql.VarChar(20), userId)
    .query(`
      SELECT
        MAX(TPS.id) AS id,
        E.emp_code,
        E.emp_name,
        STRING_AGG(S.skill_name, ', ') AS skill_name,
        COALESCE(SA.SKILL_AREA, '-') AS skill_area,
        TPS.desired_level,
        TPS.actual_level,
        TPS.gap
      FROM dbo.TrainingPlanSkills TPS
      JOIN dbo.Skills S
        ON TPS.skill_id = S.skill_id
      LEFT JOIN dbo.SKILL_AREA SA
        ON SA.ID = COALESCE(TPS.skill_area_id, S.SKILL_AREA_ID)
      LEFT JOIN dbo.Employees E
        ON TPS.employee_id = E.emp_code
      WHERE TPS.crby = @crby
      GROUP BY
        E.emp_code,
        E.emp_name,
        COALESCE(SA.SKILL_AREA, '-'),
        TPS.desired_level,
        TPS.actual_level,
        TPS.gap
      ORDER BY MAX(TPS.id) DESC;
    `);


    return NextResponse.json(
      {
        
        employees: employees.recordset,
        records: records.recordset,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { employees: [], records: [] },
      { status: 500 }
    );
  }
}

/* ===================== POST ===================== */
export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      skill_id,
      skill_area_id,
      emp_code,
      desired_level,
      actual_level,
    } = await req.json();
    
    const pool = await sql.connect(config);
    await ensureSkillApprovalColumn(pool);

    const selectedSkillAreaId = Number(skill_area_id);

    if (!Number.isFinite(selectedSkillAreaId)) {
      return NextResponse.json(
        { error: "Skill area is required" },
        { status: 400 },
      );
    }

    const selectedSkill = await pool.request()
      .input("skill_id", sql.Int, skill_id)
      .input("skill_area_id", sql.Int, selectedSkillAreaId)
      .query(`
        SELECT TOP 1
          skill_id,
          SKILL_AREA_ID AS skill_area_id
        FROM dbo.Skills
        WHERE skill_id = @skill_id
          AND SKILL_AREA_ID = @skill_area_id
          AND (IsActive = 1 OR IsActive IS NULL)
      `);

    if (selectedSkill.recordset.length === 0) {
      return NextResponse.json(
        { error: "Selected skill is not mapped with the selected skill area" },
        { status: 400 },
      );
    }

    const skillAreaId = selectedSkill.recordset[0]?.skill_area_id ?? selectedSkillAreaId;

    await pool.request()

      .input("skill_id", sql.Int, skill_id)
      .input("skill_area_id", sql.Int, skillAreaId)
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("desired_level", sql.Int, desired_level)
      .input("actual_level", sql.Int, actual_level)
      .input("crby", sql.VarChar(20), userId)
      .query(`
        INSERT INTO dbo.TrainingPlanSkills
        (

          skill_id,
          skill_area_id,
          employee_id,
          desired_level,
          actual_level,
          crby
        )
        VALUES
        (

          @skill_id,
          @skill_area_id,
          @emp_code,
          @desired_level,
          @actual_level,
          @crby
        )
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }
}

/* ===================== PUT (UPDATE) ===================== */
export async function PUT(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, desired_level, actual_level } = await req.json();

    const pool = await sql.connect(config);

    await pool.request()
      .input("id", sql.Int, id)
      .input("desired_level", sql.Int, desired_level)
      .input("actual_level", sql.Int, actual_level)
      .query(`
        UPDATE dbo.TrainingPlanSkills
        SET
          desired_level = @desired_level,
          actual_level = @actual_level
        WHERE id = @id
      `);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

/* ===================== DELETE ===================== */
export async function DELETE(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();

    const pool = await sql.connect(config);

    await pool.request()
      .input("id", sql.Int, id)
      .query(`
        DELETE FROM dbo.TrainingPlanSkills
        WHERE id = @id
      `);

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
