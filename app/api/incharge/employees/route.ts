import { NextResponse } from "next/server";
import sql from "mssql";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/options";
import { getConnection } from "@/lib/dbConnect";

/* ===================== DB CONFIG ===================== */

const pool = await getConnection();

// const config = {
//   user: "sa",
//   password: "Jindal@pex2020",
//   server: "10.7.81.3",
//   database: "TNIP_NEW", // app DB (cross-db read allowed)
//   options: {
//     trustServerCertificate: true,
//     encrypt: false,
//   },
// };

async function requireUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return session.user;
}

function getUserEmployeeCode(user: { employeeCode?: string; id?: string }) {
  return String(user.employeeCode ?? user.id ?? "").trim();
}

/* ===================== GET ===================== */
/*
GET /api/incharge/employees
      → List employees from TNIP_NEW.dbo.Employees (ARRAY)

GET /api/incharge/employees?code=123
      → Fetch single employee from Employee_DB.dbo.Employee_Master (OBJECT)
*/
export async function GET() {
  try {
    const currentUser = await requireUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userEmployeeCode = getUserEmployeeCode(currentUser);
    if (!userEmployeeCode) {
      return NextResponse.json(
        { error: "User employee code missing in session" },
        { status: 401 }
      );
    }

    // const { searchParams } = new URL(req.url);
    // const code = searchParams.get("code");


    /* ---------- FETCH BY EMPLOYEE CODE (GLOBAL DB) ---------- */
    // if (code) {
      const result = await pool
        .request()
        .input("UserEmployeeCode", sql.VarChar(20), userEmployeeCode)
        .query(`
          SELECT emp_code, emp_name
          FROM dbo.Employees
          WHERE IsActive = 1
            AND (CrBy = @UserEmployeeCode OR UpBy = @UserEmployeeCode)
          ORDER BY emp_name
        `);
      
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
    const currentUser = await requireUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      emp_code,
      emp_name,
      designation,
      department,
      functional_area,
    } = body;

    const userEmployeeCode = getUserEmployeeCode(currentUser);
    if (!userEmployeeCode) {
      return NextResponse.json(
        { error: "User employee code missing in session" },
        { status: 401 }
      );
    }

    // const pool = await sql.connect(config);

    await pool
      .request()
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("emp_name", sql.VarChar(100), emp_name)
      .input("designation", sql.VarChar(100), designation)
      .input("department", sql.VarChar(100), department)
      .input("functional_area", sql.VarChar(150), functional_area)
      .input("CrBy", sql.VarChar(20), userEmployeeCode)
      .input("UpBy", sql.VarChar(20), userEmployeeCode)
      .query(`
        IF EXISTS (
          SELECT 1 FROM dbo.Employees WHERE emp_code = @emp_code
        )
        BEGIN
          UPDATE dbo.Employees
          SET
            emp_name = @emp_name,
            designation = @designation,
            department = @department,
            functional_area = @functional_area,
            IsActive = 1,
            UpBy = @UpBy,
            UpDt = GETDATE()
          WHERE emp_code = @emp_code
        END
        ELSE
        BEGIN
          INSERT INTO dbo.Employees
          (emp_code, emp_name, designation, department, functional_area, IsActive, CrBy, CrDt, UpBy, UpDt)
          VALUES
          (@emp_code, @emp_name, @designation, @department, @functional_area, 1, @CrBy, GETDATE(), @UpBy, GETDATE())
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
    const currentUser = await requireUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      emp_code,
      emp_name,
      designation,
      department,
      functional_area,
    } = body;

    const userEmployeeCode = getUserEmployeeCode(currentUser);
    if (!userEmployeeCode) {
      return NextResponse.json(
        { error: "User employee code missing in session" },
        { status: 401 }
      );
    }

    // const pool = await sql.connect(config);

    await pool
      .request()
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("emp_name", sql.VarChar(100), emp_name)
      .input("designation", sql.VarChar(100), designation)
      .input("department", sql.VarChar(100), department)
      .input("functional_area", sql.VarChar(150), functional_area)
      .input("UpBy", sql.VarChar(20), userEmployeeCode)
      .query(`
        UPDATE dbo.Employees
        SET
          emp_name = @emp_name,
          designation = @designation,
          department = @department,
          functional_area = @functional_area,
          UpBy = @UpBy,
          UpDt = GETDATE()
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
    const currentUser = await requireUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const emp_code = searchParams.get("emp_code");

    const userEmployeeCode = getUserEmployeeCode(currentUser);
    if (!userEmployeeCode) {
      return NextResponse.json(
        { error: "User employee code missing in session" },
        { status: 401 }
      );
    }

    if (!emp_code) {
      return NextResponse.json(
        { error: "Employee code required" },
        { status: 400 }
      );
    }

    // const pool = await sql.connect(config);

    await pool
      .request()
      .input("emp_code", sql.VarChar(20), emp_code)
      .input("UpBy", sql.VarChar(20), userEmployeeCode)
      .query(`
        UPDATE dbo.Employees
        SET
          IsActive = 0,
          UpBy = @UpBy,
          UpDt = GETDATE()
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
