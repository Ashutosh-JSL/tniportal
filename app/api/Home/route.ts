import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import sql from "mssql";
import { getConnection } from "@/lib/dbConnect";

type SessionUser = {
  name?: string;
  username?: string;
  role?: string;
  employeeCode?: string;
  id?: string;
};

function toSafeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function getScalarCount(pool: sql.ConnectionPool, query: string, requestConfig?: (request: sql.Request) => sql.Request) {
  try {
    let request = pool.request();
    if (requestConfig) {
      request = requestConfig(request);
    }

    const result = await request.query(query);
    return toSafeNumber(result.recordset?.[0]?.total);
  } catch (error) {
    console.error("HOME COUNT QUERY FAILED:", query, error);
    return 0;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sessionUser = session.user as SessionUser;
    const role = String(sessionUser.role ?? "").trim();
    const employeeCode = String(sessionUser.employeeCode ?? sessionUser.id ?? "").trim();

    const pool = await getConnection();
    const isIncharge = role === "Incharge";

    const employees = await getScalarCount(
      pool,
      `
        SELECT COUNT(1) AS total
        FROM dbo.Employees
        WHERE ISNULL(IsActive, 1) = 1
        ${isIncharge ? "AND (CrBy = @userCode OR UpBy = @userCode)" : ""}
      `,
      isIncharge
        ? (request) => request.input("userCode", sql.VarChar(20), employeeCode)
        : undefined,
    );

    const skills = await getScalarCount(
      pool,
      `
        SELECT COUNT(1) AS total
        FROM dbo.Skills
      `,
    );

    const trainings = await getScalarCount(
      pool,
      `
        SELECT COUNT(1) AS total
        FROM dbo.TrainingPlan
        WHERE ISNULL(IsActive, 1) = 1
        ${isIncharge ? "AND (CrBy = @userCode OR UpBy = @userCode)" : ""}
      `,
      isIncharge
        ? (request) => request.input("userCode", sql.VarChar(20), employeeCode)
        : undefined,
    );

    const skillMappings = await getScalarCount(
      pool,
      `
        SELECT COUNT(1) AS total
        FROM dbo.TrainingPlanSkills
        ${isIncharge ? "WHERE crby = @userCode" : ""}
      `,
      isIncharge
        ? (request) => request.input("userCode", sql.VarChar(20), employeeCode)
        : undefined,
    );

    return NextResponse.json({
      user: {
        name: sessionUser.username ?? sessionUser.name ?? "",
        role,
        employeeCode,
      },
      stats: [
        { title: "Employees", value: employees },
        { title: "Skills", value: skills },
        { title: "Training Plans", value: trainings },
        { title: "Skill Mappings", value: skillMappings },
      ],
    });
  } catch (error) {
    console.error("HOME API ERROR:", error);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
