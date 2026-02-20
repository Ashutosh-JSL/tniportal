import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";

export async function GET(req: NextRequest) {
  try{

  const { searchParams } = new URL(req.url);
  const empId = searchParams.get("empId");
  console.log(empId);

  const result = await sql.query(`
    SELECT TOP 1
      plan_desc,
      year,
      responsible_person,
      target_date,
      training_location
    FROM TrainingPlan
    WHERE employee_id = ${empId}
    ORDER BY plan_id DESC
  `);

  return NextResponse.json(result.recordset[0] || null);
  }
  catch (err: any) {

    return NextResponse.json({
      error: err.message
    }, { status: 500 });

  }
}

