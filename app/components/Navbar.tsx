"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Role = string;

export default function Navbar() {
  const router = useRouter();

  const [roles] = useState<Role[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const storedRoles = localStorage.getItem("userRoles");
    return storedRoles ? JSON.parse(storedRoles) : [];
  });
  const [activeRole, setActiveRole] = useState<Role | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem("activeRole");
  });
  const [username] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem("username");
  });
  const [masterOpen, setMasterOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!roles.length || !activeRole) {
      router.replace("/login");
    }
  }, [activeRole, roles.length, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        roleMenuRef.current &&
        !roleMenuRef.current.contains(event.target as Node)
      ) {
        setRoleMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!activeRole) return null;

  /* ================= MENU PER ROLE ================= */
  const menuItems: Record<string, { name: string; href: string }[]> = {
    Admin: [
      { name: "Dashboard", href: "/Home" },
      { name: "Skill Authorization", href: "/incharge/skills-authorization" },
      { name: "Training Authorization", href: "/incharge/training-plan-authorization" },
      { name: "Post-Training Authorization", href: "/incharge/post-training-authorization" },
    ],

    Incharge: [
      { name: "Dashboard", href: "/Home" },
      { name: "Employees", href: "/incharge/employees" },
      { name: "Skills Acquired", href: "/incharge/skills" },
      { name: "Training Plan", href: "/incharge/training-plan" },
      { name: "Post-training", href: "/incharge/Post-Training" },
    ],
  };

  const currentMenu = menuItems[activeRole] || [];

  /* ================= ROLE SWITCH ================= */
  const handleRoleChange = (role: string) => {
    setActiveRole(role);
    localStorage.setItem("activeRole", role);
  };

  /* ================= LOGOUT ================= */
  const handleLogout = async () => {
    localStorage.clear();
    await signOut({ redirect: false });
    router.replace("/login");
    router.refresh();
  };

  /* ================= UI ================= */
  return (
    <nav className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shadow-lg">

  <div className="max-w-7xl mx-auto px-6">




    {/* ================= BOTTOM ROW ================= */}
    <div className="flex items-center justify-between py-3 border-t border-white/20 text-white">

      {/* LEFT — LOGO + TITLE */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center font-bold">
          TN
        </div>

        <div>
          <h1 className="font-semibold">
            Training Need Identification Portal
          </h1>
          <p className="text-xs text-white/70">
            {activeRole} Dashboard
          </p>
        </div>
      </div>

      {/* RIGHT — USER + LOGOUT */}
      <div className="flex items-center gap-3 bg-white/10 px-3 py-1.5 rounded-full">

        <div className="h-7 w-7 rounded-full bg-white text-blue-600 flex items-center justify-center text-xs font-bold">
          {username?.charAt(0).toUpperCase()}
        </div>

        <span className="text-sm">{username}</span>

        <button
          onClick={handleLogout}
          className="bg-white text-blue-600 px-3 py-1 rounded-md text-sm hover:bg-gray-100"
        >
          Logout
        </button>

      </div>

    </div>

    {/* ================= TOP ROW ================= */}
    <div className="flex h-14 items-center justify-between text-white text-sm font-medium">

      {/* MENU */}
      <div className="flex items-center gap-8">

        {currentMenu.map(item => (
          <Link key={item.name} href={item.href}>
            {item.name}
          </Link>
        ))}

        {/* MASTER DROPDOWN */}
        <div className="relative">
          <button
            onClick={() => setMasterOpen(!masterOpen)}
            className="flex items-center gap-1"
          >
            Master ▾
          </button>

          {masterOpen && (
            <div className="absolute top-8 left-0 w-56 bg-white rounded-xl shadow-xl z-50 text-sm text-slate-700">

              {activeRole === "Incharge" && (
                <>
                  <Link href="/incharge/skill-master" className="block px-4 py-3 hover:bg-indigo-50">
                    Add Skills
                  </Link>
                  <Link href="/incharge/training-plan-master" className="block px-4 py-3 hover:bg-indigo-50">
                    Add Training Plan
                  </Link>
                </>
              )}

              {activeRole === "Admin" && (
                <Link href="/incharge/role-auth" className="block px-4 py-3 hover:bg-indigo-50">
                  Role Authorization
                </Link>
              )}

            </div>
          )}
        </div>

      </div>

      {/* ROLE SELECTOR */}
      <div className="relative" ref={roleMenuRef}>
        <button
          type="button"
          onClick={() => setRoleMenuOpen((open) => !open)}
          className="
            min-w-40 rounded-2xl border border-white/25 bg-white/16
            px-4 py-2.5 text-left text-sm font-semibold text-white
            shadow-[0_10px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl
            transition hover:bg-white/24 focus:border-white/45
            focus:bg-white/24 focus:outline-none
          "
        >
          <span>{activeRole}</span>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/80">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-5 w-5 transition ${roleMenuOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </button>

        {roleMenuOpen ? (
          <div
            className="
              absolute right-0 top-[calc(100%+0.6rem)] z-50 min-w-40 overflow-hidden
              rounded-2xl border border-slate-200 bg-white shadow-2xl
              shadow-slate-900/20
            "
          >
            {roles.map((role) => {
              const isActive = role === activeRole;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    handleRoleChange(role);
                    setRoleMenuOpen(false);
                  }}
                  className={`
                    flex w-full items-center justify-between px-4 py-3 text-left
                    text-sm transition
                    ${isActive
                      ? "bg-gradient-to-r from-blue-50 to-indigo-50 font-semibold text-indigo-700"
                      : "text-slate-700 hover:bg-slate-50"}
                  `}
                >
                  <span>{role}</span>
                  {isActive ? (
                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
                      Active
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

    </div>

    

  </div>

</nav>
  );
}
