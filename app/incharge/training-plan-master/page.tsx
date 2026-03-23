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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">Training Plan Master</h1>
              <p className="mt-1 text-sm text-slate-600">Create and maintain training plan templates.</p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Plan Management
            </div>
          </div>

          <form onSubmit={submit} className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-4">
              <label htmlFor="planHeading" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Plan Heading
              </label>
              <input
                id="planHeading"
                required
                placeholder="Enter plan heading"
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={planHeading}
                onChange={(e) => setPlanHeading(e.target.value)}
              />
            </div>

            <div className="md:col-span-5">
              <label htmlFor="planDesc" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Plan Description
              </label>
              <input
                id="planDesc"
                placeholder="Enter plan description"
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={planDesc}
                onChange={(e) => setPlanDesc(e.target.value)}
              />
            </div>

            <div className="md:col-span-3 md:self-end">
              <button className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(37,99,235,0.38)]">
                {editingPlanId ? "Update Plan" : "Add Plan"}
              </button>
            </div>

            {editingPlanId ? (
              <div className="md:col-span-3 md:col-start-10">
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
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Training Plans</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Total: {plans.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Plan Heading</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Plan Description</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Created</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                      No plans found.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.plan_master_id} className="transition hover:bg-cyan-50/55">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{plan.plan_Heading}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{plan.plan_Desc || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {new Date(plan.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-2">
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
