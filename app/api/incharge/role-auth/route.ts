import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getConnection } from "@/lib/dbConnect";
import { decrypt } from "@/lib/aesEncryption";
import { sendEmail } from "@/lib/mailer";

// Editable constant BCC for role-assignment mails
const ROLE_ASSIGNMENT_BCC = "ashutosh.agrawal@jindalstainless.com";
const TNI_PORTAL_LOGIN_URL = "https://jslaisrv01.jindalstainless.com:4436/login";

type RoleAuthPayload = {
  userId?: string | number;
  roleId?: number;
  raid?: number;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildRoleAssignmentEmailBody(params: {
  employeeName: string;
  employeeCode: string;
  roleName: string;
  password: string;
}) {
  const { employeeName, employeeCode, roleName, password } = params;
  const safeEmployeeName = escapeHtml(employeeName);
  const safeEmployeeCode = escapeHtml(employeeCode);
  const safeRoleName = escapeHtml(roleName);
  const safePassword = escapeHtml(password);

  return `
    <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#0f4c81;padding:22px 28px;color:#ffffff;">
          <h2 style="margin:0;font-size:22px;font-weight:700;line-height:1.3;">Training Need Identification Portal</h2>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:#dbeafe;">Role assignment confirmation</p>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Dear ${safeEmployeeName},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
            You have been assigned the <strong>${safeRoleName}</strong> role in the Training Need Identification Portal.
          </p>

          <div style="margin:22px 0;padding:18px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
            <p style="margin:0 0 10px;font-size:14px;line-height:1.5;"><strong>User ID (Employee Code):</strong> ${safeEmployeeCode}</p>
            <p style="margin:0 0 10px;font-size:14px;line-height:1.5;"><strong>Password:</strong> ${safePassword}</p>
            <p style="margin:0;font-size:14px;line-height:1.5;"><strong>Role:</strong> ${safeRoleName}</p>
          </div>

          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;">
            Please use the button below to log in with these credentials.
          </p>

          <a href="${TNI_PORTAL_LOGIN_URL}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;background:#0f4c81;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:700;">
            Login to TNI Portal
          </a>

          <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
            If the button does not work, copy and paste this link into your browser:<br/>
            <a href="${TNI_PORTAL_LOGIN_URL}" target="_blank" rel="noopener noreferrer" style="color:#0f4c81;text-decoration:underline;">${TNI_PORTAL_LOGIN_URL}</a>
          </p>
        </div>

        <div style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:13px;line-height:1.5;color:#475569;">Regards,<br/>Training Team</p>
        </div>
      </div>
    </div>
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
        e.Employee_Name AS Full_Name,
        ra.Role_ID,
        rm.Role_Desc,
        ra.CrDt
      FROM Role_Auth ra
      LEFT JOIN Role_Master rm ON ra.Role_ID = rm.Role_ID
      LEFT JOIN [Employee_DB].[dbo].[Employee_Master] e
        ON e.Employee_Code COLLATE DATABASE_DEFAULT = CAST(ra.UserID AS NVARCHAR(50)) COLLATE DATABASE_DEFAULT
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

/* ================= UPDATE ROLE ASSIGNMENT ================= */
export async function PUT(req: NextRequest) {
  try {
    const payload = (await req.json()) as RoleAuthPayload;
    const raid = Number(payload.raid);
    const roleId = Number(payload.roleId);

    if (!Number.isFinite(raid) || !Number.isFinite(roleId)) {
      return NextResponse.json(
        { error: "Valid raid and roleId are required" },
        { status: 400 },
      );
    }

    const pool = await getConnection();

    const assignmentResult = await pool
      .request()
      .input("raid", sql.Int, raid)
      .query(`
        SELECT TOP 1 RAID, UserID, Role_ID
        FROM Role_Auth
        WHERE RAID = @raid
      `);

    const assignment = assignmentResult.recordset[0] as
      | { RAID: number; UserID: string | number; Role_ID: number }
      | undefined;

    if (!assignment) {
      return NextResponse.json(
        { error: "Role assignment not found" },
        { status: 404 },
      );
    }

    const userId = String(assignment.UserID ?? "").trim();
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid role assignment user" },
        { status: 400 },
      );
    }

    const duplicateResult = await pool
      .request()
      .input("raid", sql.Int, raid)
      .input("userId", sql.NVarChar(50), userId)
      .input("roleId", sql.Int, roleId)
      .query(`
        SELECT TOP 1 RAID
        FROM Role_Auth
        WHERE UserID = @userId
          AND Role_ID = @roleId
          AND RAID <> @raid
      `);

    if (duplicateResult.recordset.length > 0) {
      return NextResponse.json(
        { error: "This role is already assigned to the employee" },
        { status: 409 },
      );
    }

    await pool
      .request()
      .input("raid", sql.Int, raid)
      .input("roleId", sql.Int, roleId)
      .query(`
        UPDATE Role_Auth
        SET Role_ID = @roleId
        WHERE RAID = @raid
      `);

    return NextResponse.json({ message: "Role assignment updated successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 },
    );
  }
}

/* ================= DELETE ROLE ASSIGNMENT ================= */
export async function DELETE(req: NextRequest) {
  try {
    const payload = (await req.json()) as RoleAuthPayload;
    const raid = Number(payload.raid);

    if (!Number.isFinite(raid)) {
      return NextResponse.json(
        { error: "Valid raid is required" },
        { status: 400 },
      );
    }

    const pool = await getConnection();

    const deleteResult = await pool
      .request()
      .input("raid", sql.Int, raid)
      .query(`
        DELETE FROM Role_Auth
        WHERE RAID = @raid
      `);

    if (!deleteResult.rowsAffected[0]) {
      return NextResponse.json(
        { error: "Role assignment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Role assignment deleted successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 },
    );
  }
}
