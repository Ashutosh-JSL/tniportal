import { NextResponse } from "next/server";
import sql from "mssql";

const config = {
  user: "sa",
  password: "Jindal@pex2020",
  server: "10.7.81.3",
  database: "TNIP_NEW_update",
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
};

export async function GET() {
  try {
    const pool = await sql.connect(config);

    const result = await pool.request().query(`
      SELECT
        outcome_id AS id,
        outcome_rating AS rating,
        outcome_name AS name
      FROM dbo.mst_training_outcome
      WHERE status = 1
      ORDER BY outcome_rating ASC
    `);

    return NextResponse.json(result.recordset);
  } catch (error) {
    console.error("TRAINING OUTCOMES GET ERROR:", error);
    return NextResponse.json([], { status: 500 });
  }
}
