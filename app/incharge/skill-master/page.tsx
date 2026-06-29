"use client";

import { useEffect, useState } from "react";

interface Skill {
  skill_id: number;
  skill_name: string;
  skill_area_id: number | null;
  skill_area: string | null;
  approval_status: "Pending" | "Approved" | "Rejected";
}

interface SkillArea {
  id: number;
  skill_area: string;
}

export default function SkillMasterPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillAreas, setSkillAreas] = useState<SkillArea[]>([]);
  const [skillName, setSkillName] = useState("");
  const [skillAreaId, setSkillAreaId] = useState("");
  const [editingSkillId, setEditingSkillId] = useState<number | null>(null);
  const pendingCount = skills.filter(
    (skill) => skill.approval_status === "Pending",
  ).length;

  const loadData = async () => {
    const res = await fetch("/api/incharge/skill-master?includeAll=true&includeAreas=true", {
      cache: "no-store",
    });
    const data = await res.json();
    setSkills(Array.isArray(data?.skills) ? data.skills : []);
    setSkillAreas(Array.isArray(data?.skillAreas) ? data.skillAreas : []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const resetForm = () => {
    setSkillName("");
    setSkillAreaId("");
    setEditingSkillId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!skillName.trim()) {
      alert("Skill name is required");
      return;
    }

    if (!skillAreaId) {
      alert("Skill area is required");
      return;
    }

    const method = editingSkillId ? "PUT" : "POST";
    const body = editingSkillId
      ? {
          skill_id: editingSkillId,
          skill_name: skillName.trim(),
          skill_area_id: Number(skillAreaId),
        }
      : {
          skill_name: skillName.trim(),
          skill_area_id: Number(skillAreaId),
        };

    const res = await fetch("/api/incharge/skill-master", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Unable to save skill");
      return;
    }
    alert(
      editingSkillId
        ? "Skill updated successfully"
        : "Skill added successfully and sent for admin approval",
    );
    resetForm();
    void loadData();
  };
  const startEdit = (skill: Skill) => {
    setEditingSkillId(skill.skill_id);
    setSkillName(skill.skill_name);
    setSkillAreaId(skill.skill_area_id ? String(skill.skill_area_id) : "");
  };

  const deleteSkill = async (skillId: number) => {
    const ok = confirm("Are you sure you want to delete this skill?");
    if (!ok) return;

    const res = await fetch("/api/incharge/skill-master", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_id: skillId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Unable to delete skill");
      return;
    }
    
    alert("Skill deleted successfully");
    if (editingSkillId === skillId) {
      resetForm();
    }
    void loadData();
  };

  const getStatusClass = (status: Skill["approval_status"]) =>
    status === "Approved"
      ? "bg-green-100 text-green-700"
      : status === "Pending"
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-700";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">Skill Master</h1>
              <p className="mt-1 text-sm text-slate-600">
                Add and maintain your training skill catalog. New skills appear in dropdowns only after admin approval.
              </p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Skill Management
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <label htmlFor="skillName" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Skill Name
              </label>
              <input
                id="skillName"
                required
                placeholder="Enter skill name"
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="skillArea" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Skill Area
              </label>
              <select
                id="skillArea"
                required
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={skillAreaId}
                onChange={(e) => setSkillAreaId(e.target.value)}
              >
                <option value="">Select skill area</option>
                {skillAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.skill_area}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 md:self-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(37,99,235,0.38)]"
              >
                {editingSkillId ? "Update" : "Add"}
              </button>
            </div>

            {editingSkillId ? (
              <div className="md:col-span-2 md:self-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </form>
        </div>

        <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Skills List</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Total: {skills.length}
            </span>
          </div>

          {pendingCount > 0 ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {pendingCount} skill{pendingCount === 1 ? "" : "s"} pending approval. Admin users can review these from Skill Master Approval.
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Skill Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Skill Area</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Approval</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Action</th>
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
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{skill.skill_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{skill.skill_area || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(skill.approval_status)}`}>
                          {skill.approval_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-wrap items-center justify-center gap-2">
                          {skill.approval_status === "Pending" ? (
                            <span className="rounded bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                              Admin approval required
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => startEdit(skill)}
                            className="rounded bg-blue-600 px-3 py-1 text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSkill(skill.skill_id)}
                            className="rounded bg-red-600 px-3 py-1 text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
