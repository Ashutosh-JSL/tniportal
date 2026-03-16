import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { comparePassword } from "@/lib/aesEncryption";
import { getConnection } from "@/lib/dbConnect";

type LoginRow = {
  Employee_Code: string | number;
  Employee_Name: string;
  Emp_Pwd: string;
  E_MAIL: string;
  Role_Desc: string | null;
};

type AuthUser = {
  id: string;
  employeeCode: string;
  username: string;
  email: string;
  role: string;
  roles: string[];
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing username or password");
        }

        try {
          const pool = await getConnection();
          const result = await pool
            .request()
            .input("login", credentials.username)
            .query(`
              SELECT
                e.Employee_Code,
                e.Employee_Name,
                e.Emp_Pwd,
                e.E_MAIL,
                r.Role_Desc
              FROM [Employee_DB].[dbo].[Employee_Master] e
              LEFT JOIN dbo.Role_Auth er
                ON er.UserID = e.Employee_Code COLLATE DATABASE_DEFAULT
              LEFT JOIN dbo.Role_Master r
                ON r.Role_ID = er.Role_ID
              WHERE (
                e.Employee_Code COLLATE DATABASE_DEFAULT = @login
                OR e.E_MAIL COLLATE DATABASE_DEFAULT = @login
              )
              AND e.Status = 1
            `);
          const rows = result.recordset as LoginRow[];

          if (rows.length === 0) {
            throw new Error("User does not exist");
          }

          const user = result.recordset[0];
          const isPasswordValid = comparePassword(
            credentials.password,
            user.Emp_Pwd,
          );

          if (!isPasswordValid) {
            throw new Error("Invalid credentials");
          }

          const roles = Array.from(
            new Set(
              rows
                .map((row) => row.Role_Desc)
                .filter((role): role is string => Boolean(role)),
            ),
          );

          if (roles.length === 0) {
            throw new Error("No role assigned to this user");
          }

          const defaultRole = roles.includes("Admin")
            ? "Admin"
            : roles.includes("Incharge")
              ? "Incharge"
              : roles[0];

          const authUser: AuthUser = {
            id: String(user.Employee_Code),
            employeeCode: String(user.Employee_Code),
            username: user.Employee_Name,
            email: user.E_MAIL,
            role: defaultRole,
            roles,
          };

          return authUser;
        } catch (error: unknown) {
          console.error("Auth Error:", error);
          const message =
            error instanceof Error ? error.message : "Authentication failed";
          throw new Error(message);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.roles = user.roles;
        token.username = user.username;
        token.employeeCode = user.employeeCode;
      }

      if (trigger === "update" && session?.role) {
        if (token.roles && token.roles.includes(session.role)) {
          token.role = session.role;
        } else {
          console.error(
            "JWT Callback: Role Update Failed - Role not allowed or roles missing",
            { tokenRoles: token.roles, requested: session.role },
          );
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.roles = token.roles as string[];
        session.user.username = token.username as string;
        session.user.employeeCode = token.employeeCode as string;
        session.user.id =
          typeof token.sub === "string"
            ? token.sub
            : (token.employeeCode as string);
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
