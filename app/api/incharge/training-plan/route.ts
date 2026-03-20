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
  return String(user?.employeeCode ?? user?.id ?? "").trim();
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

/* ===================== POST ===================== */
export async function POST(req: Request) {

  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("RECEIVED:", body);


    const {
      plan_desc,
      employee_id,
      year,
      responsible_person,
      target_date,
      training_location,
    } = body;

    const pool = await sql.connect(config);

    await pool.request()
      .input("employee_id", sql.VarChar(50), employee_id)
      .input("plan_desc", sql.VarChar(255), plan_desc)
      .input("year", sql.VarChar(10), year || null)
      .input("responsible_person", sql.NVarChar(150), responsible_person || null)
      .input("target_date", sql.Date, target_date || null)
     
      .input("training_location", sql.NVarChar(20), training_location || null)
      .input("status", sql.Bit, 1)
      .input("CrBy", sql.VarChar(20), userId)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        INSERT INTO dbo.TrainingPlan
        (
          employee_id,
          plan_desc,
          year,
          responsible_person,
          target_date,
          
          training_location,
          status,
          created_at,
          IsActive,
          CrBy,
          CrDt,
          UpBy,
          UpDt
        )
        VALUES
        (
          @employee_id,
          @plan_desc,
          @year,
          @responsible_person,
          @target_date,
         
          @training_location,
          @status,
          GETDATE(),
          1,
          @CrBy,
          GETDATE(),
          @UpBy,
          GETDATE()
        )
      `);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("POST ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}

/* ===================== GET ===================== */
export async function GET() {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pool = await sql.connect(config);

    const result = await pool.request()
    .input("user_id", sql.VarChar(20), userId)
    .query(`
      SELECT
        TP.plan_id,
        TP.plan_desc,
        TP.year,
        TP.responsible_person,
        TP.target_date,
        TP.training_location,
        TP.employee_id,
        E.emp_name
      FROM dbo.TrainingPlan TP
      INNER JOIN dbo.Employees E
        ON TP.employee_id = E.emp_code
      WHERE TP.IsActive = 1
        AND (TP.CrBy = @user_id OR TP.UpBy = @user_id)
      ORDER BY TP.plan_id DESC
    `);

    return NextResponse.json(result.recordset || []);

  } catch (error) {
    console.error("GET ERROR:", error);
    return NextResponse.json([]);
  }
}

/* ===================== PUT ===================== */
export async function PUT(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      plan_id,
      plan_desc,
      employee_id,
      year,
      responsible_person,
      target_date,
      training_location,
    } = await req.json();

    const pool = await sql.connect(config);

    await pool.request()
      .input("plan_id", sql.Int, plan_id)
      .input("employee_id", sql.VarChar(50), employee_id)
      .input("plan_desc", sql.VarChar(255), plan_desc)
      .input("year", sql.VarChar(10), year || null)
      .input("responsible_person", sql.NVarChar(150), responsible_person || null)
      .input("target_date", sql.Date, target_date || null)
      .input("training_location", sql.NVarChar(20), training_location || null)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        UPDATE dbo.TrainingPlan
        SET
          employee_id = @employee_id,
          plan_desc = @plan_desc,
          year = @year,
          responsible_person = @responsible_person,
          target_date = @target_date,
          training_location = @training_location,
          UpBy = @UpBy,
          UpDt = GETDATE()
        WHERE plan_id = @plan_id
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}


/* ===================== DELETE ===================== */
export async function DELETE(req: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan_id } = await req.json();

    const pool = await sql.connect(config);

    await pool.request()
      .input("plan_id", sql.Int, plan_id)
      .input("UpBy", sql.VarChar(20), userId)
      .query(`
        UPDATE dbo.TrainingPlan
        SET
          IsActive = 0,
          status = 0,
          UpBy = @UpBy,
          UpDt = GETDATE()
        WHERE plan_id = @plan_id
      `);

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
