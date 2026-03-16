import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { getConnection } from "@/lib/dbConnect";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const empId = searchParams.get("empId");

    if (!empId) {
      return NextResponse.json([]);
    }

    const pool = await getConnection();
    const result = await pool.request()
      .input("empId", sql.VarChar(20), empId)
      .query(`
        SELECT
          plan_id,
          plan_desc,
          year,
          responsible_person,
          target_date,
          training_location
        FROM dbo.TrainingPlan
        WHERE employee_id = @empId
        ORDER BY plan_id DESC
      `);

    return NextResponse.json(result.recordset || []);
  } catch (error) {
    console.error("POST TRAINING BY EMPLOYEE ERROR:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
