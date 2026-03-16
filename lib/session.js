import { IronSessionOptions } from "iron-session";

export const sessionOptions = {
  password: "complex_password_at_least_32_characters",
  cookieName: "training_portal_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
  },
};