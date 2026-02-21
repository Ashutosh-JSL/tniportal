import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/dbConnect";

const pool = await getConnection();

export async function GET(req: NextRequest) {
  try {

    const { searchParams } = new URL(req.url);
    const empId = searchParams.get("empId");

    if (!empId) {
      return NextResponse.json([]);
    }

    const result = await pool.query`
      SELECT
        plan_id,
        plan_desc,
        year,
        responsible_person,
        target_date,
        
        training_location
      FROM TrainingPlan
      WHERE employee_id = ${empId}
      ORDER BY plan_id DESC
    `;

    // ✅ return ALL assigned trainings
    return NextResponse.json(result.recordset || []);

  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}