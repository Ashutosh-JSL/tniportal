import NextAuth from "next-auth";
import { authOptions } from "./options";

const handler = NextAuth(authOptions);

// Next.js 15+ requires named exports instead of default export for API routes
export const GET = handler;
export const POST = handler;