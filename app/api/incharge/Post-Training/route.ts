import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import fs from "fs";
import path from "path";
import { getConnection } from "@/lib/dbConnect";


const pool = await getConnection();

/* ================= GET ================= */
export async function GET() {

  const result = await pool.query`
    
SELECT
      t.*,
      e.emp_name
    FROM Post_training_plan t
    LEFT JOIN employees e
      ON t.employee_id = e.emp_code
    ORDER BY t.plan_id DESC


  `;

  return NextResponse.json(result.recordset);
}

/* ================= POST ================= */
export async function POST(req: NextRequest) {

  try {

    const data = await req.formData();
    console.log(data)

    const file = data.get("file") as File | null;

    let fileName = null;

    if (file) {
      fileName = Date.now() + "_" + file.name;

      fs.writeFileSync(
        path.join(process.cwd(), "public/evidence", fileName),
        Buffer.from(await file.arrayBuffer())
      );
    }

    await pool.query`
  INSERT INTO Post_training_plan
  (
    plan_desc,
    year,
    responsible_person,
    target_date,
    Completion_date,
    training_location,
    employee_id,
    effectiveness_desired,
    effectiveness_actual,
    gap_fulfilled,
    key_learnings,
    evidence_file
  )
  VALUES
  (
    ${data.get("plan_desc")},
    ${data.get("year")},
    ${data.get("responsible_person")},
    ${data.get("target_date")},
    ${data.get("Completion_date")},
    ${data.get("training_location")},
    ${data.get("employee_id")},
    ${data.get("effectiveness_desired")},
    ${data.get("effectiveness_actual")},
    ${data.get("gap_fulfilled") === "true" ? 1 : 0},
    ${data.get("key_learnings")},
    ${fileName}
  )
`;

    return NextResponse.json({
      success: true
    });

  } catch (err: any) {

    return NextResponse.json({
      error: err.message
    }, { status: 500 });

  }
}

/* ================= DELETE ================= */
export async function DELETE(req: NextRequest) {

  const { plan_id } = await req.json();

  await sql.query`
    DELETE FROM Post_training_plan
    WHERE plan_id = ${plan_id}
  `;

  return NextResponse.json({ message: "deleted" });
}