"use client";

import { useEffect, useState } from "react";

interface Plan {
  plan_master_id: number;
  plan_name: string;
  created_at: string;
}

export default function TrainingPlanMasterPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planName, setPlanName] = useState("");

  const loadData = async () => {
    const res = await fetch("/api/incharge/training-plan-master", {
      cache: "no-store",
    });
    setPlans(await res.json());
  };

  useEffect(() => {
    loadData();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    await fetch("/api/incharge/training-plan-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_name: planName }),
    });

    setPlanName("");
    loadData();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow p-8">
        <h1 className="text-2xl font-semibold mb-6">
          📘 Training Plan Master
        </h1>

        {/* Add Plan */}
        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-4 mb-8"
        >
          <input
            required
            placeholder="Plan Description"
            className="border rounded-lg px-4 py-2"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
          />

          <button className="bg-indigo-600 text-white py-2 rounded-lg">
            ➕ Add Plan
          </button>
        </form>

        {/* List */}
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Plan Description</th>
              <th className="p-3 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.plan_master_id} className="border-b">
                <td className="p-3">{p.plan_name}</td>
                <td className="p-3">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
}
