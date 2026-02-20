"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Role = string;

export default function Navbar() {
  const router = useRouter();

  const [roles, setRoles] = useState<Role[]>([]);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [masterOpen, setMasterOpen] = useState(false);

  /* ================= LOAD SESSION ================= */
  useEffect(() => {
    const storedRoles = localStorage.getItem("userRoles");
    const storedActiveRole = localStorage.getItem("activeRole");
    const storedUsername = localStorage.getItem("username");

    if (storedRoles && storedActiveRole) {
      setRoles(JSON.parse(storedRoles));
      setActiveRole(storedActiveRole);
      setUsername(storedUsername);
    } else {
      router.replace("/login");
    }

    setIsCheckingAuth(false);
  }, [router]);

  if (isCheckingAuth || !activeRole) return null;

  /* ================= MENU PER ROLE ================= */
  const menuItems: Record<string, { name: string; href: string }[]> = {
    Admin: [
      { name: "Dashboard", href: "/Home" },
      { name: "Skills Acquired", href: "/incharge/skills" },
      { name: "Training Plan", href: "/incharge/training-plan" },
      { name: "Post-training", href: "/incharge/Post-Training" },
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
  const handleLogout = () => {
    localStorage.clear();
    router.replace("/login");
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
      <select
  value={activeRole}
  onChange={(e) => handleRoleChange(e.target.value)}
  className="
    bg-white/20 backdrop-blur-md
    text-white
    px-4 py-2
    rounded-full
    text-sm font-medium
    border border-white/30
    shadow-lg
    outline-none
    hover:bg-white/30
    transition
  "
>
  {roles.map(role => (
    <option key={role} value={role} className="text-black">
      {role}
    </option>
  ))}
</select>

    </div>

    

  </div>

</nav>
  );
}