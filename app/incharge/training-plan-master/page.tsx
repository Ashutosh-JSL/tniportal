"use client";

import { useEffect, useState } from "react";

interface Plan {
  plan_master_id: number;
  plan_Heading: string;
  plan_Desc: string;
  created_at: string;
}

export default function TrainingPlanMasterPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planHeading, setPlanHeading] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);

  const loadData = async () => {
    const res = await fetch("/api/incharge/training-plan-master", {
      cache: "no-store",
    });
    const data = await res.json();
    setPlans(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const resetForm = () => {
    setPlanHeading("");
    setPlanDesc("");
    setEditingPlanId(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!planHeading.trim()) {
      alert("Plan heading required");
      return;
    }

    const method = editingPlanId ? "PUT" : "POST";
    const payload = editingPlanId
      ? {
          plan_master_id: editingPlanId,
          plan_Heading: planHeading.trim(),
          plan_Desc: planDesc.trim(),
        }
      : {
          plan_Heading: planHeading.trim(),
          plan_Desc: planDesc.trim(),
        };

    const res = await fetch("/api/incharge/training-plan-master", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Unable to save training plan master");
      return;
    }

    alert(editingPlanId ? "Plan updated successfully" : "Plan added successfully");
    resetForm();
    void loadData();
  };

  const startEdit = (plan: Plan) => {
    setEditingPlanId(plan.plan_master_id);
    setPlanHeading(plan.plan_Heading || "");
    setPlanDesc(plan.plan_Desc || "");
  };

  const deletePlan = async (planMasterId: number) => {
    const ok = confirm("Are you sure you want to delete this plan?");
    if (!ok) return;

    const res = await fetch("/api/incharge/training-plan-master", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_master_id: planMasterId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Unable to delete plan");
      return;
    }

    alert("Plan deleted successfully");
    if (editingPlanId === planMasterId) {
      resetForm();
    }
    void loadData();
  };

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow">
        <h1 className="mb-6 text-2xl font-semibold">Training Plan Master</h1>

        <form onSubmit={submit} className="mb-8 grid grid-cols-1 gap-4">
          <input
            required
            placeholder="Plan Heading"
            className="rounded-lg border px-4 py-2"
            value={planHeading}
            onChange={(e) => setPlanHeading(e.target.value)}
          />

          <input
            placeholder="Plan Description"
            className="rounded-lg border px-4 py-2"
            value={planDesc}
            onChange={(e) => setPlanDesc(e.target.value)}
          />

          <div className="flex gap-3">
            <button className="rounded-lg bg-indigo-600 px-5 py-2 text-white">
              {editingPlanId ? "Update Plan" : "Add Plan"}
            </button>
            {editingPlanId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg bg-slate-500 px-5 py-2 text-white"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Plan Heading</th>
              <th className="p-3 text-left">Plan Description</th>
              <th className="p-3 text-left">Created</th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-500">
                  No plans found.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.plan_master_id} className="border-b">
                  <td className="p-3">{plan.plan_Heading}</td>
                  <td className="p-3">{plan.plan_Desc}</td>
                  <td className="p-3">{new Date(plan.created_at).toLocaleDateString()}</td>
                  <td className="space-x-2 p-3 text-center">
                    <button
                      type="button"
                      onClick={() => startEdit(plan)}
                      className="rounded bg-blue-600 px-3 py-1 text-white"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePlan(plan.plan_master_id)}
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
