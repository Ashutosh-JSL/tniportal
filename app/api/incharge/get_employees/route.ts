import { NextResponse } from "next/server";
import sql from "mssql";
import { getConnection } from "@/lib/dbConnect";

/* ===================== DB CONFIG ===================== */
    const pool = await getConnection();

/* ===================== GET ===================== */
/*
  1️⃣ GET /api/incharge/employees
      → List employees from TNIP_NEW.dbo.Employees (ARRAY)

  2️⃣ GET /api/incharge/employees?code=123
      → Fetch single employee from Employee_DB.dbo.Employee_Master (OBJECT)
*/
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    const pool = await getConnection();

    /* ================= FETCH BY EMP CODE ================= */
    if (code) {
      const result = await pool
        .request()
        .input("code", sql.VarChar(20), code)
        .query(`
          SELECT 
            EM.Employee_Code AS emp_code,
            EM.Employee_Name AS emp_name,
            EM.Grade_Name AS designation,
            EM.Department_Name AS department,
            EM.Funcational_Area AS functional_area,

            -- ✅ REAL REPORTING MANAGER
            DM.Direct_Manager_Name

          FROM Employee_DB.dbo.Employee_Master EM

          LEFT JOIN Employee_DB.dbo.Darwain_Employee_Master DM
            ON EM.Employee_Code = DM.Employee_Id

          WHERE EM.Employee_Code = @code
          AND EM.Status = 1
        `);

      if (result.recordset.length === 0) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }

      return NextResponse.json(result.recordset[0]);
    }

    /* ================= LIST LOCAL ================= */
    const list = await pool.request().query(`
      SELECT
      [Id],
        emp_code,
        emp_name,
        designation,
        department,
        functional_area,
        Reporting_Manager AS Direct_Manager_Name
      FROM dbo.Employees
      WHERE status = 1
      ORDER BY [Id] desc
    `);

    return NextResponse.json(list.recordset);

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
      Direct_Manager_Name, // ✅ RECEIVE FROM FRONTEND
    } = body;

    const pool = await getConnection();

    await pool
      .request()
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("emp_name", sql.VarChar(100), emp_name)
      .input("designation", sql.VarChar(100), designation)
      .input("department", sql.VarChar(100), department)
      .input("functional_area", sql.VarChar(150), functional_area)
      .input("reporting_manager", sql.NVarChar(150), Direct_Manager_Name) // ✅ NEW
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.Employees WHERE emp_code = @emp_code
        )
        BEGIN
          INSERT INTO dbo.Employees
          (emp_code, emp_name, designation, department, functional_area, Reporting_Manager, status)
          VALUES
          (@emp_code, @emp_name, @designation, @department, @functional_area, @reporting_manager, 1)
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
      Direct_Manager_Name, // ✅ RECEIVE
    } = body;

    const pool = await getConnection();

    await pool
      .request()
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("emp_name", sql.VarChar(100), emp_name)
      .input("designation", sql.VarChar(100), designation)
      .input("department", sql.VarChar(100), department)
      .input("functional_area", sql.VarChar(150), functional_area)
      .input("reporting_manager", sql.NVarChar(150), Direct_Manager_Name) // ✅ NEW
      .query(`
        UPDATE dbo.Employees
        SET
          emp_name = @emp_name,
          designation = @designation,
          department = @department,
          functional_area = @functional_area,
          Reporting_Manager = @reporting_manager   -- ✅ UPDATE
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

    const pool = await getConnection();

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
