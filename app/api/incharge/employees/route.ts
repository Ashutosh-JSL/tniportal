import { NextResponse } from "next/server";
import sql from "mssql";

/* ===================== DB CONFIG ===================== */
const config = {
  user: "sa",
  password: "Ashusolid@1234",
  server: "JSLLAP0727",
  database: "TNIP_NEW", // app DB (cross-db read allowed)
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
};

/* ===================== GET ===================== */
/*
  1️⃣ GET /api/incharge/employees
      → List employees from TNIP_NEW.dbo.Employees (ARRAY)

  2️⃣ GET /api/incharge/employees?code=123
      → Fetch single employee from Employee_DB.dbo.Employee_Master (OBJECT)
*/
export async function GET(req: Request) {
  try {
    // const { searchParams } = new URL(req.url);
    // const code = searchParams.get("code");

    const pool = await sql.connect(config);

    /* ---------- FETCH BY EMPLOYEE CODE (GLOBAL DB) ---------- */
    // if (code) {
      const result = await pool
        .request()
        // .input("code", sql.VarChar(20), code)
        .query(`
          Select emp_code,emp_name from employees 
        `);

      if (result.recordset.length === 0) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json(result.recordset); // ✅ SINGLE OBJECT
    // }

    /* ---------- LIST ALL (LOCAL DB) ---------- */
    // const list = await pool.request().query(`
    //   SELECT
    //     emp_code,
    //     emp_name,
    //     designation,
    //     department,
    //     functional_area
    //   FROM dbo.Employees
    //   WHERE status = 1
    //   ORDER BY emp_name
    // `);

    // return NextResponse.json(list.recordset); // ✅ ARRAY
    
  } catch (error) {
    console.error("GET ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load employees" },
      { status: 500 }
    );
  }
}

/* ===================== POST ===================== */
/* Save employee to TNIP_NEW.dbo.Employees */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      emp_code,
      emp_name,
      designation,
      department,
      functional_area,
    } = body;

    const pool = await sql.connect(config);

    await pool
      .request()
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("emp_name", sql.VarChar(100), emp_name)
      .input("designation", sql.VarChar(100), designation)
      .input("department", sql.VarChar(100), department)
      .input("functional_area", sql.VarChar(150), functional_area)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.Employees WHERE emp_code = @emp_code
        )
        BEGIN
          INSERT INTO dbo.Employees
          (emp_code, emp_name, designation, department, functional_area, status)
          VALUES
          (@emp_code, @emp_name, @designation, @department, @functional_area, 1)
        END
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST ERROR:", error);
    return NextResponse.json(
      { error: "Failed to save employee" },
      { status: 500 }
    );
  }
}

/* ===================== PUT ===================== */
/* Update local employee */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      emp_code,
      emp_name,
      designation,
      department,
      functional_area,
    } = body;

    const pool = await sql.connect(config);

    await pool
      .request()
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("emp_name", sql.VarChar(100), emp_name)
      .input("designation", sql.VarChar(100), designation)
      .input("department", sql.VarChar(100), department)
      .input("functional_area", sql.VarChar(150), functional_area)
      .query(`
        UPDATE dbo.Employees
        SET
          emp_name = @emp_name,
          designation = @designation,
          department = @department,
          functional_area = @functional_area
        WHERE emp_code = @emp_code
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update employee" },
      { status: 500 }
    );
  }
}

/* ===================== DELETE ===================== */
/* Soft delete */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const emp_code = searchParams.get("emp_code");

    if (!emp_code) {
      return NextResponse.json(
        { error: "Employee code required" },
        { status: 400 }
      );
    }

    const pool = await sql.connect(config);

    await pool
      .request()
      .input("emp_code", sql.VarChar(20), emp_code)
      .query(`
        UPDATE dbo.Employees
        SET status = 0
        WHERE emp_code = @emp_code
      `);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete employee" },
      { status: 500 }
    );
  }
}
