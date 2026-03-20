import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getConnection } from "@/lib/dbConnect";
import { decrypt } from "@/lib/aesEncryption";
import { sendEmail } from "@/lib/mailer";

// Editable constant BCC for role-assignment mails
const ROLE_ASSIGNMENT_BCC = "ashutosh.agrawal@jindalstainless.com";

type RoleAuthPayload = {
  userId?: string | number;
  roleId?: number;
};

type UserWithRoleRow = {
  Employee_Code: string | number;
  Employee_Name: string | null;
  E_MAIL: string | null;
  Emp_Pwd: string | null;
  Role_Desc: string | null;
};

type AdminEmailRow = {
  E_MAIL: string | null;
};

function buildRoleAssignmentEmailBody(params: {
  employeeName: string;
  employeeCode: string;
  roleName: string;
  password: string;
}) {
  const { employeeName, employeeCode, roleName, password } = params;

  return `
    <p>Dear ${employeeName},</p>
    <p>You have been assigned as ${roleName} in Training Need Identification Portal.</p>
    <p>
      <strong>User ID (Employee Code):</strong> ${employeeCode}<br/>
      <strong>Password:</strong> ${password}<br/>
      <strong>Role:</strong> ${roleName}
    </p>
    <p>You can now log in with these credentials.</p>
    <p>Regards,<br/>Training Team</p>
  `;
}

/* ================= GET ROLE ASSIGNMENTS ================= */
export async function GET() {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        ra.RAID,
        ra.UserID,
		    DEM.Full_Name,
        ra.Role_ID,
        rm.Role_Desc,
        ra.CrDt
      FROM Role_Auth ra
      LEFT JOIN Role_Master rm ON ra.Role_ID = rm.Role_ID
	  JOIN Employee_DB.dbo.Darwain_Employee_Master DEM ON ra.UserID = DEM.Employee_Id
      ORDER BY ra.RAID DESC
    `);

    return NextResponse.json(result.recordset);

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch role assignments" },
      { status: 500 }
    );
  }
}

/* ================= INSERT ROLE ================= */
export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as RoleAuthPayload;
    const userId = String(payload.userId ?? "").trim();
    const roleId = Number(payload.roleId);

    if (!userId || !Number.isFinite(roleId)) {
      return NextResponse.json(
        { error: "Valid userId and roleId are required" },
        { status: 400 },
      );
    }

    const pool = await getConnection();

    const existingAssignment = await pool
      .request()
      .input("userId", sql.NVarChar(50), userId)
      .input("roleId", sql.Int, roleId)
      .query(`
        SELECT TOP 1 RAID
        FROM Role_Auth
        WHERE UserID = @userId
          AND Role_ID = @roleId
      `);

    if (existingAssignment.recordset.length > 0) {
      return NextResponse.json(
        { error: "This role is already assigned to the employee" },
        { status: 409 },
      );
    }

    await pool
      .request()
      .input("userId", sql.NVarChar(50), userId)
      .input("roleId", sql.Int, roleId)
      .query(`
        INSERT INTO Role_Auth (UserID, Role_ID)
        VALUES (@userId, @roleId)
      `);

    const userResult = await pool
      .request()
      .input("userId", sql.NVarChar(50), userId)
      .input("roleId", sql.Int, roleId)
      .query(`
        SELECT TOP 1
          e.Employee_Code,
          e.Employee_Name,
          e.E_MAIL,
          e.Emp_Pwd,
          rm.Role_Desc
        FROM [Employee_DB].[dbo].[Employee_Master] e
        LEFT JOIN dbo.Role_Master rm
          ON rm.Role_ID = @roleId
        WHERE e.Employee_Code COLLATE DATABASE_DEFAULT = @userId
          AND e.Status = 1
      `);

    const userRow = userResult.recordset[0] as UserWithRoleRow | undefined;

    if (!userRow) {
      return NextResponse.json({
        message: "Role assigned successfully, but user details not found for email",
        mailSent: false,
      });
    }

    const userEmail = String(userRow.E_MAIL ?? "").trim();
    if (!userEmail) {
      return NextResponse.json({
        message: "Role assigned successfully, but user email is missing",
        mailSent: false,
      });
    }

    const encryptedPassword = String(userRow.Emp_Pwd ?? "").trim();
    if (!encryptedPassword) {
      return NextResponse.json({
        message: "Role assigned successfully, but user password is missing",
        mailSent: false,
      });
    }

    let plainPassword = "";
    try {
      plainPassword = decrypt(encryptedPassword);
    } catch (error) {
      console.error("Failed to decrypt employee password:", error);
      return NextResponse.json({
        message: "Role assigned successfully, but password decryption failed",
        mailSent: false,
      });
    }

    const roleName = String(userRow.Role_Desc ?? "Assigned Role").trim();
    const employeeName = String(userRow.Employee_Name ?? "User").trim();
    const employeeCode = String(userRow.Employee_Code ?? userId).trim();

    const adminResult = await pool.request().query(`
      SELECT DISTINCT e.E_MAIL
      FROM [Employee_DB].[dbo].[Employee_Master] e
      INNER JOIN dbo.Role_Auth ra
        ON ra.UserID = e.Employee_Code COLLATE DATABASE_DEFAULT
      INNER JOIN dbo.Role_Master rm
        ON rm.Role_ID = ra.Role_ID
      WHERE rm.Role_Desc = 'Admin'
        AND e.Status = 1
        AND ISNULL(e.E_MAIL, '') <> ''
    `);

    const ccEmail = (adminResult.recordset as AdminEmailRow[])
      .map((row) => String(row.E_MAIL ?? "").trim())
      .filter((email) => email.length > 0)
      .join(",");

    const mailResult = await sendEmail({
      toEmail: userEmail,
      ccEmail,
      bccEmail: ROLE_ASSIGNMENT_BCC,
      subject: `Role Assigned - ${roleName}`,
      emailBody: buildRoleAssignmentEmailBody({
        employeeName,
        employeeCode,
        roleName,
        password: plainPassword,
      }),
    });

    if (!mailResult.success) {
      return NextResponse.json({
        message: "Role assigned successfully, but email delivery failed",
        mailSent: false,
        mailError: mailResult.error?.message ?? "Unknown mail error",
      });
    }

    return NextResponse.json({
      message: "Role assigned successfully and email sent",
      mailSent: true,
      ccEmail,
      bccEmail: ROLE_ASSIGNMENT_BCC,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Insert failed" },
      { status: 500 }
    );
  }
}
