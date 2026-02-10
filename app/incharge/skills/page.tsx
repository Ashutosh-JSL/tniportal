"use client";

import { useEffect, useState } from "react";

/* ===================== INTERFACES ===================== */
interface Plan {
  plan_master_id: number;
  plan_name: string;
}

interface Skill {
  skill_id: number;
  skill_name: string;
}

interface Employee {
  emp_code: string;
  emp_name: string;
}

interface Record {
  id: number;
  plan_name: string;
  skill_name: string;
  emp_code:string;
  emp_name: string;
  desired_level: number;
  actual_level: number;
  gap: number;
}

/* ===================== COMPONENT ===================== */
export default function TrainingPlanSkillPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);

  const [form, setForm] = useState({
    plan_master_id: "",
    employee_id: "",
    desired_level: "",
    actual_level: "",
  });

  /* ===================== LOAD DATA ===================== */
  const loadAll = async () => {
    const res = await fetch("/api/incharge/training-plan-skill-mapping", {
      cache: "no-store",
    });

    const data = await res.json();
    console.log(data)

    setPlans(data.plans ?? []);
    setSkills(data.skills ?? []);
    setEmployees(data.employees ?? []);
    setRecords(data.records ?? []);
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* ===================== SUBMIT ===================== */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSkills.length === 0) {
      alert("Please select at least one skill");
      return;
    }

    for (const skill of selectedSkills) {
      await fetch("/api/incharge/training-plan-skill-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_master_id: form.plan_master_id,
          emp_code: form.employee_id,
          skill_id: skill.skill_id,
          desired_level: form.desired_level,
          actual_level: form.actual_level,
        }),
      });
    }

    setSelectedSkills([]);
    setForm({
      plan_master_id: "",
      employee_id: "",
      desired_level: "",
      actual_level: "",
    });

    loadAll();
  };

  /* ===================== RENDER ===================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* ===================== FORM ===================== */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h1 className="text-2xl font-semibold text-slate-800 mb-6">
            🔗 Training Plan – Skill Mapping
          </h1>

          <form
            onSubmit={submit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {/* PLAN */}
            <select
              required
              className="border rounded-lg px-4 py-2"
              value={form.plan_master_id}
              onChange={(e) =>
                setForm({ ...form, plan_master_id: e.target.value })
              }
            >
              <option value="">Select Training Plan</option>
              {plans.map((p) => (
                <option key={p.plan_master_id} value={p.plan_master_id}>
                  {p.plan_name}
                </option>
              ))}
            </select>

            {/* EMPLOYEE */}
            <select
              required
              className="border rounded-lg px-4 py-2"
              value={form.employee_id}
              onChange={(e) =>
                setForm({ ...form, employee_id: e.target.value })
              }
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.emp_code} value={emp.emp_code}>
                  {emp.emp_name}
                </option>
              ))}
            </select>

            {/* SKILL SELECT */}
            <select
              className="border rounded-lg px-4 py-2"
              value=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (!id) return;

                const skill = skills.find((s) => s.skill_id === id);
                if (
                  skill &&
                  !selectedSkills.some((s) => s.skill_id === skill.skill_id)
                ) {
                  setSelectedSkills([...selectedSkills, skill]);
                }
              }}
            >
              <option value="">Select Skill</option>
              {skills.map((s) => (
                <option key={s.skill_id} value={s.skill_id}>
                  {s.skill_name}
                </option>
              ))}
            </select>

            {/* SELECTED SKILLS */}
            {selectedSkills.length > 0 && (
              <div className="lg:col-span-3 bg-slate-50 border rounded-lg px-4 py-3">
                <span className="font-semibold text-sm">Skills Selected:</span>

                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSkills.map((skill) => (
                    <span
                      key={skill.skill_id}
                      className="flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm"
                    >
                      {skill.skill_name}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSkills((prev) =>
                            prev.filter((s) => s.skill_id !== skill.skill_id),
                          )
                        }
                        className="text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <input
              className="border rounded-lg px-4 py-2"
              placeholder="Desired Level"
              value={form.desired_level}
              onChange={(e) =>
                setForm({ ...form, desired_level: e.target.value })
              }
            />

            <input
              className="border rounded-lg px-4 py-2"
              placeholder="Actual Level"
              value={form.actual_level}
              onChange={(e) =>
                setForm({ ...form, actual_level: e.target.value })
              }
            />

            <div className="lg:col-span-3">
              <button className="bg-indigo-600 text-white px-8 py-2 rounded-lg">
                ➕ Add Skill Mapping
              </button>
            </div>
          </form>
        </div>

        {/* ===================== GRID ===================== */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            📋 Skill Mapping List
          </h2>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="p-4">Plan</th>
                <th className="p-4">Employee</th>
                <th className="p-4">Skill</th>
                <th className="p-4">Desired</th>
                <th className="p-4">Actual</th>
                <th className="p-4">Gap</th>
              </tr>
            </thead>

            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No records found
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-indigo-50/40">
                    <td className="p-4">{r.plan_name}</td>
                    <td className="p-4">{r.emp_name}</td>
                    <td className="p-4">{r.skill_name}</td>
                    <td className="p-4">{r.desired_level}</td>
                    <td className="p-4">{r.actual_level}</td>
                    <td className="p-4">
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs">
                        {r.gap}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
