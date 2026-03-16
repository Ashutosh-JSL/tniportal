"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        username: identifier,
        password,
        redirect: false,
      });

      if (!result) {
        setErrorMessage("Unable to sign in right now");
        return;
      }

      if (result.error) {
        setErrorMessage(result.error);
        return;
      }

      const session = await getSession();

      if (!session?.user) {
        setErrorMessage("Session was not created");
        return;
      }

      const roles = session.user.roles ?? [];
      const activeRole = session.user.role ?? roles[0] ?? "";
      const username = session.user.username ?? session.user.name ?? "";
      const employeeCode = session.user.employeeCode ?? session.user.id ?? "";

      localStorage.setItem("userRoles", JSON.stringify(roles));
      localStorage.setItem("activeRole", activeRole);
      localStorage.setItem("username", username);
      localStorage.setItem("employeeCode", employeeCode);

      router.replace("/Home");
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-end bg-cover bg-center px-6 md:px-12 lg:px-20"
      style={{ backgroundImage: "url('/training-bg.png')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/55 to-slate-900/20"></div>

      <div className="relative w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <div className="text-center mb-8">
          <h3 className="text-lg font-semibold uppercase tracking-widest text-blue-300 drop-shadow-md">
            Training Need Identification Portal
          </h3>

          <h2 className="text-3xl font-bold text-white mt-2">
            Welcome Back
          </h2>

          <p className="text-gray-300 text-sm mt-1">
            Please login to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm text-gray-200">
              Email / Employee Code
            </label>

            <input
              type="text"
              placeholder="Enter your email or employee code"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="text-sm text-gray-200">
              Password
            </label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-gray-300 outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 py-3 font-semibold text-white shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Signing In..." : "Login"}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-300 hover:text-white cursor-pointer transition">
            Forgot Password?
          </p>
        </div>

      </div>
    </div>
  );
}
