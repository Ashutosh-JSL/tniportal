import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      name: session.user.username ?? session.user.name ?? "",
      role: session.user.role ?? "",
      employeeCode: session.user.employeeCode ?? session.user.id ?? "",
    },
    stats: [
      { title: "Employees", value: 125 },
      { title: "Trainings", value: 18 },
    ],
  });
}
