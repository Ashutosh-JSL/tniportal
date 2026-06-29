"use client";

import { useEffect, useState } from "react";

type Skill = {
  skill_id: number;
  skill_name: string;
  skill_area: string | null;
  approval_status: "Pending" | "Approved" | "Rejected";
};

export default function SkillMasterApprovalPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );

  const isAdmin = activeRole.trim().toLowerCase() === "admin";

  const loadSkills = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/incharge/skill-master?includeAll=true", {
        cache: "no-store",
      });
      const data = await res.json();
      setSkills(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSkills();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const reviewSkill = async (
    skillId: number,
    action: "approve" | "reject",
  ) => {
    const res = await fetch("/api/incharge/skill-master", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_id: skillId, action }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Unable to update skill approval");
      return;
    }

    void loadSkills();
  };

  const getStatusClass = (status: Skill["approval_status"]) =>
    status === "Approved"
      ? "bg-green-100 text-green-700"
      : status === "Pending"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-700";

  if (activeRole && !isAdmin) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-8">
            This page is only available for the Admin role.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                Skill Master Approval
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Approve skills before they become available in dropdowns.
              </p>
            </div>
            <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Admin Review
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-800">
              Skills
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Total: {skills.length}
            </span>
          </div>

          {loading ? (
            <p className="px-1 py-3 text-sm text-slate-500">Loading skills...</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Skill Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Skill Area
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Approval
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {skills.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                        No skills found.
                      </td>
                    </tr>
                  ) : (
                    skills.map((skill) => (
                      <tr key={skill.skill_id} className="transition hover:bg-cyan-50/55">
                        <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                          {skill.skill_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {skill.skill_area || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(skill.approval_status)}`}>
                            {skill.approval_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {skill.approval_status === "Pending" ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => reviewSkill(skill.skill_id, "approve")}
                                className="rounded bg-green-600 px-3 py-1 text-white"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => reviewSkill(skill.skill_id, "reject")}
                                className="rounded bg-red-600 px-3 py-1 text-white"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Review completed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
