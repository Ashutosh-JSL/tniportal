"use client";

import { useEffect, useState } from "react";

interface Skill {
  skill_id: number;
  skill_name: string;
}

export default function SkillMasterPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skill_name, setSkillName] = useState("");

  const loadData = async () => {
    const res = await fetch("/api/incharge/skill-master", {
      cache: "no-store",
    });
    setSkills(await res.json());
  };

  useEffect(() => {
    loadData();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    await fetch("/api/incharge/skill-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_name }),
    });

    setSkillName("");
    loadData();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-semibold mb-6">🧠 Skill Master</h1>

        <form onSubmit={submit} className="flex gap-4 mb-8">
          <input
            required
            placeholder="Skill Name"
            className="border rounded-lg px-4 py-2 flex-1"
            value={skill_name}
            onChange={e => setSkillName(e.target.value)}
          />
          <button className="bg-emerald-600 text-white px-6 rounded-lg">
            ➕ Add
          </button>
        </form>

        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3">Skill Name</th>
            </tr>
          </thead>
          <tbody>
            {skills.map(s => (
              <tr key={s.skill_id} className="border-b">
                <td className="p-3">{s.skill_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
