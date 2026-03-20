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
  password: "Ashusolid@1234",
  server: "JSLLAP0727",
  database: "TNIP_NEW",
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
};

/* ===================== GET ===================== */
export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await sql.connect(config);

    const skills = await pool.request().query(`
      SELECT skill_id, skill_name
      FROM dbo.Skills
    `);

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
        TPS.desired_level,
        TPS.actual_level,
        TPS.gap
      FROM dbo.TrainingPlanSkills TPS
      JOIN dbo.Skills S
        ON TPS.skill_id = S.skill_id
      LEFT JOIN dbo.Employees E
        ON TPS.employee_id = E.emp_code
      WHERE TPS.crby = @crby
      GROUP BY
        E.emp_code,
        E.emp_name,
        TPS.desired_level,
        TPS.actual_level,
        TPS.gap
      ORDER BY MAX(TPS.id) DESC;
    `);


    return NextResponse.json(
      {
        
        skills: skills.recordset,
        employees: employees.recordset,
        records: records.recordset,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {  skills: [], employees: [], records: [] },
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
      emp_code,
      desired_level,
      actual_level,
    } = await req.json();
    
    const pool = await sql.connect(config);

    await pool.request()
    
      .input("skill_id", sql.Int, skill_id)
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("desired_level", sql.Int, desired_level)
      .input("actual_level", sql.Int, actual_level)
      .input("crby", sql.VarChar(20), userId)
      .query(`
        INSERT INTO dbo.TrainingPlanSkills
        (
          
          skill_id,
          employee_id,
          desired_level,
          actual_level,
          crby
        )
        VALUES
        (
          
          @skill_id,
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
