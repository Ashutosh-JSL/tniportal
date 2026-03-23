"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Role = string;

type NavItem = {
  name: string;
  href: string;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

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

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRoleMenuOpen(false);
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!activeRole) return null;

  const menuItems: Record<string, NavItem[]> = {
    Admin: [
      { name: "Dashboard", href: "/Home" },
      { name: "Skill Authorization", href: "/incharge/skills-authorization" },
      {
        name: "Training Authorization",
        href: "/incharge/training-plan-authorization",
      },
      {
        name: "Post-Training Authorization",
        href: "/incharge/post-training-authorization",
      },
      { name: "Role Authorization", href: "/incharge/role-auth" },
    ],
    Incharge: [
      { name: "Dashboard", href: "/Home" },
      { name: "Employees", href: "/incharge/employees" },
      { name: "Skills Acquired", href: "/incharge/skills" },
      { name: "Training Plan", href: "/incharge/training-plan" },
      { name: "Post-training", href: "/incharge/Post-Training" },
      { name: "Add Skills", href: "/incharge/skill-master" },
      { name: "Add Training Plan", href: "/incharge/training-plan-master" },
    ],
  };

  const currentMenu = menuItems[activeRole] || [];

  const handleRoleChange = (role: string) => {
    setActiveRole(role);
    localStorage.setItem("activeRole", role);
    setRoleMenuOpen(false);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    localStorage.clear();
    await signOut({ redirect: false });
    router.replace("/login");
    router.refresh();
  };

  const usernameInitial = username?.charAt(0).toUpperCase() || "U";

  return (
    <>
      <nav className="sticky top-0 z-50 px-4 pt-2 sm:px-6 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
        <div className="relative mx-auto max-w-[1700px] overflow-visible rounded-3xl border border-white/65 bg-[linear-gradient(125deg,rgba(241,249,255,0.92),rgba(226,243,252,0.78),rgba(232,238,255,0.9))] text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/25 blur-2xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-44 w-44 rounded-full bg-indigo-400/20 blur-2xl" />
          <div className="px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-md">
                  TN
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold sm:text-lg">
                    Training Need Identification Portal
                  </h1>
                  <p className="text-xs font-medium text-slate-600">{activeRole} Dashboard</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="relative" ref={roleMenuRef}>
                  <button
                    type="button"
                    onClick={() => setRoleMenuOpen((open) => !open)}
                    className="min-w-32 rounded-xl border border-cyan-100/90 bg-white/80 px-4 py-2 text-left text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-[0_12px_24px_rgba(14,116,144,0.18)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                  >
                    <div className="flex items-center justify-between">
                      <span>{activeRole}</span>
                      <svg
                        className={`h-4 w-4 transition-transform duration-200 ${roleMenuOpen ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {roleMenuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.55rem)] z-50 min-w-44 rounded-2xl border border-white/80 bg-white/85 p-2 shadow-[0_20px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                      {roles.map((role) => {
                        const isActive = role === activeRole;

                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleRoleChange(role)}
                            className={`mb-1 block w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-all duration-200 last:mb-0 ${
                              isActive
                                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)]"
                                : "text-slate-700 hover:bg-cyan-50"
                            }`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div
                  className="relative"
                  ref={menuRef}
                  onMouseEnter={() => setMenuOpen(true)}
                  onFocusCapture={() => setMenuOpen(true)}
                >
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${
                      menuOpen
                        ? "border-blue-400 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.35)]"
                        : "border-cyan-100/90 bg-white/80 text-slate-700 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-[0_12px_24px_rgba(14,116,144,0.18)]"
                    }`}
                  >
                    Menu
                    <svg
                      className={`h-4 w-4 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-0 top-full z-[85] mt-5 max-w-[92vw]">
                      <div className="rounded-2xl border border-white/90 bg-white/85 p-3 shadow-[0_20px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl">
                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap rounded-xl bg-gradient-to-r from-cyan-50/80 via-sky-50/70 to-indigo-50/80 p-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                          {currentMenu.map((item) => {
                            const isActive = pathname === item.href;

                            return (
                              <Link
                                key={item.name}
                                href={item.href}
                                onClick={() => setMenuOpen(false)}
                                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold tracking-wide transition-all duration-200 ${
                                  isActive
                                    ? "border-blue-300 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)]"
                                    : "border-slate-100 bg-white/95 text-slate-700 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:text-slate-900 hover:shadow-[0_12px_22px_rgba(14,116,144,0.2)]"
                                }`}
                              >
                                {item.name}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 rounded-full border border-cyan-100/90 bg-white/70 px-3 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition-all duration-200 hover:shadow-[0_12px_24px_rgba(14,116,144,0.2)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-sm">
                    {usernameInitial}
                  </div>
                  <span className="max-w-36 truncate text-sm font-medium text-slate-700">{username}</span>
                  <button
                    onClick={handleLogout}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:border-rose-700 hover:bg-rose-700 hover:text-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
