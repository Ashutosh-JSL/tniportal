import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    user: { name: "Ashutosh Agrawal", role: "Admin" },
    stats: [
      { title: "Employees", value: 125 },
      { title: "Trainings", value: 18 },
    ],
  });
}
