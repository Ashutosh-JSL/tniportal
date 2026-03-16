import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      employeeCode: string;
      username: string;
      email: string;
      role: string;
      roles: string[];
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    employeeCode: string;
    username: string;
    email: string;
    role: string;
    roles: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    roles: string[];
    username: string;
    employeeCode: string;
  }
}
