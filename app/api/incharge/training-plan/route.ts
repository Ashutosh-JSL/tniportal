import { NextResponse } from "next/server";
import sql from "mssql";

const config = {
  user: "sa",
  password: "Jindal@pex2020",
  server: "10.7.81.3",
  database: "TNIP_NEW",
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
};

/* ===================== POST ===================== */
export async function POST(req: Request) {

  try {
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
          created_at
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
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT
        TP.plan_id,
        TP.plan_desc,
        TP.year,
        TP.responsible_person,
        TP.target_date,
        TP.training_location,
        
        E.emp_name
      FROM dbo.TrainingPlan TP
      INNER JOIN dbo.Employees E
        ON TP.employee_id = E.emp_code
      ORDER BY TP.plan_id DESC
    `);

    return NextResponse.json(result.recordset || []);

  } catch (error) {
    console.error("GET ERROR:", error);
    return NextResponse.json([]);
  }
}


/* ===================== DELETE ===================== */
export async function DELETE(req: Request) {
  try {
    const { plan_id } = await req.json();

    const pool = await sql.connect(config);

    await pool.request()
      .input("plan_id", sql.Int, plan_id)
      .query(`DELETE FROM dbo.TrainingPlan WHERE plan_id = @plan_id`);

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}
