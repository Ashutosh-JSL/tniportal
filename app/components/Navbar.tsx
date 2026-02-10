"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter(); // ✅ Router initialized

  const menuItems = [
    { name: "Dashboard", href: "/Home" },
    { name: "Employees", href: "/incharge/employees" },
    { name: "Skills Acquired", href: "/incharge/skills" },
    { name: "Trainings", href: "/incharge/training-plan" },
    
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold">
              TN
            </div>
            <div>
              <h1 className="text-white font-semibold leading-tight">
                Training Need Identification Portal
              </h1>
              <p className="text-xs text-white/70">
                In-Charge Dashboard
              </p>
            </div>
          </div>

          {/* Menu */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white">
            {menuItems.map(item => (
              <Link key={item.name} href={item.href} className="relative group">
                {item.name}
                <span className="absolute left-0 -bottom-1 h-0.5 bg-white w-0 group-hover:w-full transition-all"></span>
              </Link>
            ))}

            {/* Master Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1 cursor-pointer">
                Master <span className="text-xs">▾</span>
              </button>

              <div
                className="
                  absolute top-8 left-0 w-52
                  bg-white rounded-xl shadow-xl
                  opacity-0 invisible
                  group-hover:opacity-100 group-hover:visible
                  transition-all duration-200
                  text-sm text-slate-700
                "
              >
                <Link
                  href="/incharge/skill-master"
                  className="block px-4 py-3 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  ➕ Add Skills
                </Link>

                <Link
                  href="/incharge/training-plan-master"
                  className="block px-4 py-3 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  ➕ Add Training Plan
                </Link>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
              <div className="h-7 w-7 rounded-full bg-white text-blue-600 flex items-center justify-center text-xs font-bold">
                U
              </div>
              <span className="text-sm text-white">User</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => router.replace("/login")}
              className="bg-white text-blue-600 px-3 py-1 rounded-md text-sm hover:bg-gray-100 transition"
            >
              Logout
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}
