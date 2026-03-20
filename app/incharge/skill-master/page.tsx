"use client";

import { useEffect, useState } from "react";

interface Skill {
  skill_id: number;
  skill_name: string;
}

export default function SkillMasterPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillName, setSkillName] = useState("");
  const [editingSkillId, setEditingSkillId] = useState<number | null>(null);

  const loadData = async () => {
    const res = await fetch("/api/incharge/skill-master", {
      cache: "no-store",
    });
    const data = await res.json();
    setSkills(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const resetForm = () => {
    setSkillName("");
    setEditingSkillId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!skillName.trim()) {
      alert("Skill name is required");
      return;
    }

    const method = editingSkillId ? "PUT" : "POST";
    const body = editingSkillId
      ? { skill_id: editingSkillId, skill_name: skillName.trim() }
      : { skill_name: skillName.trim() };

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

    alert(editingSkillId ? "Skill updated successfully" : "Skill added successfully");
    resetForm();
    void loadData();
  };

  const startEdit = (skill: Skill) => {
    setEditingSkillId(skill.skill_id);
    setSkillName(skill.skill_name);
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

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-8 shadow">
        <h1 className="mb-6 text-2xl font-semibold">Skill Master</h1>

        <form onSubmit={submit} className="mb-8 flex gap-4">
          <input
            required
            placeholder="Skill Name"
            className="flex-1 rounded-lg border px-4 py-2"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
          />
          <button className="rounded-lg bg-emerald-600 px-6 text-white">
            {editingSkillId ? "Update" : "Add"}
          </button>
          {editingSkillId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-slate-500 px-6 text-white"
            >
              Cancel
            </button>
          ) : null}
        </form>

        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Skill Name</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {skills.length === 0 ? (
              <tr>
                <td colSpan={2} className="p-4 text-center text-slate-500">
                  No skills found.
                </td>
              </tr>
            ) : (
              skills.map((skill) => (
                <tr key={skill.skill_id} className="border-b">
                  <td className="p-3">{skill.skill_name}</td>
                  <td className="space-x-2 p-3 text-center">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
