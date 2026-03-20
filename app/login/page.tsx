"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

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

      if (!result || result.error) {
        setErrorMessage("Invalid credentials");
        return;
      }

      const session = await getSession();
      if (!session?.user) {
        setErrorMessage("Session was not created");
        return;
      }

      // keep your logic
      const roles = session.user.roles ?? [];
      const activeRole = session.user.role ?? roles[0] ?? "";
      const username = session.user.username ?? session.user.name ?? "";
      const employeeCode = session.user.employeeCode ?? session.user.id ?? "";

      localStorage.setItem("userRoles", JSON.stringify(roles));
      localStorage.setItem("activeRole", activeRole);
      localStorage.setItem("username", username);
      localStorage.setItem("employeeCode", employeeCode);

      window.location.href = "/Home";
    } catch (error) {
      console.error(error);
      setErrorMessage("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* Background */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ease-in-out ${
          showLoginForm ? "blur-md scale-110" : "blur-0 scale-100"
        }`}
        style={{ backgroundImage: "url('/CRM_Img.jpg')" }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Branding */}
      <div className="relative z-10 flex flex-col items-center justify-start text-center pt-16 sm:pt-20">

        <h1 className="text-3xl sm:text-5xl font-semibold text-white tracking-wide">
          Training Need Identification Portal
        </h1>

        <p className="text-gray-300 mt-3">
          Empowering employees through structured learning and development
        </p>

        {/* Smooth Login Button */}
        <div
          className={`transition-all duration-500 ${
            showLoginForm
              ? "opacity-0 translate-y-2 pointer-events-none"
              : "opacity-100 translate-y-0"
          }`}
        >
          <button
            onClick={() => setShowLoginForm(true)}
            className="mt-6 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Login
          </button>
        </div>
      </div>

      {/* Login Form */}
      <div
        className={`relative z-20 flex items-center justify-center  px-4 transition-all duration-500 ${
          showLoginForm
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl shadow-blue-500/10 transition-all duration-500">

          {/* Close */}
          <button
            onClick={() => setShowLoginForm(false)}
            className="absolute top-4 right-4 text-white text-xl hover:scale-110 transition"
          >
            ✕
          </button>

          <h2 className="text-2xl font-bold text-white text-center mb-6">
            Welcome Back
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div>
              <label className="text-sm text-gray-200">
                Email / Employee Code
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full mt-1 px-4 py-3 rounded-xl bg-white/20 text-white outline-none focus:ring-2 focus:ring-blue-400 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm text-gray-200">Password</label>

              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-white/20 text-white outline-none focus:ring-2 focus:ring-blue-400 transition"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-white hover:scale-110 transition"
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Error */}
            {errorMessage && (
              <p className="text-red-300 text-sm text-center">
                {errorMessage}
              </p>
            )}

            {/* Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold hover:opacity-90 transition-all duration-300"
            >
              {isSubmitting ? "Signing In..." : "Login"}
            </button>
          </form>

          <div className="text-center mt-5">
            <p className="text-sm text-gray-300 hover:text-white cursor-pointer transition">
              Forgot Password?
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}