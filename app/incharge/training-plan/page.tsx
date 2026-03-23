"use client";

import { useEffect, useState } from "react";

interface Employee {
  emp_code: string;
  emp_name: string;
}

interface Plan {
  plan_id: number;
  plan_desc: string;
  employee_id: string;
  emp_name: string;
  year: string;
  responsible_person: string;
  target_date: string;
  training_location: string;
}

interface PlanMaster {
  plan_master_id: number;
  plan_Heading: string;
}

interface AuthorizationItem {
  source_plan_id: number | null;
  status: string;
}

type FormState = {
  plan_desc: string;
  employee_id: string;
  year: string;
  responsible_person: string;
  target_date: string;
  training_location: string;
};

const emptyForm: FormState = {
  plan_desc: "",
  employee_id: "",
  year: "",
  responsible_person: "",
  target_date: "",
  training_location: "",
};

export default function TrainingPlanPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planHeadings, setPlanHeadings] = useState<PlanMaster[]>([]);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [submittedPlanIds, setSubmittedPlanIds] = useState<number[]>([]);
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );

  const loadPlans = async () => {
    const [plansRes, authorizationRes] = await Promise.all([
      fetch("/api/incharge/training-plan", {
        cache: "no-store",
      }),
      fetch("/api/incharge/training-plan-authorization", {
        cache: "no-store",
      }),
    ]);

    const plansData = await plansRes.json();
    const authorizationData = await authorizationRes.json();

    setPlans(Array.isArray(plansData) ? plansData : []);

    const pendingIds = Array.isArray(authorizationData)
      ? authorizationData
          .filter(
            (item: AuthorizationItem) =>
              item.status === "Pending" &&
              Number.isFinite(Number(item.source_plan_id)),
          )
          .map((item: AuthorizationItem) => Number(item.source_plan_id))
      : [];

    setSubmittedPlanIds(pendingIds);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/incharge/employees")
        .then((res) => res.json())
        .then((data) => setEmployees(Array.isArray(data) ? data : []));

      void fetch("/api/incharge/training-plan-master")
        .then((res) => res.json())
        .then((data) => setPlanHeadings(Array.isArray(data) ? data : []));

      void loadPlans();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee_id) {
      alert("Please select employee");
      return;
    }

    const res = await fetch("/api/incharge/training-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!res.ok) {
      alert("Something went wrong while saving");
      return;
    }

    alert("Training plan submitted successfully");
    setFormData(emptyForm);
    await loadPlans();
  };

  const startEdit = (plan: Plan) => {
    setEditingId(plan.plan_id);
    setEditForm({
      plan_desc: plan.plan_desc ?? "",
      employee_id: plan.employee_id ?? "",
      year: plan.year ?? "",
      responsible_person: plan.responsible_person ?? "",
      target_date: plan.target_date ? plan.target_date.split("T")[0] : "",
      training_location: plan.training_location ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async (planId: number) => {
    const res = await fetch("/api/incharge/training-plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        ...editForm,
      }),
    });

    if (!res.ok) {
      alert("Failed to update training plan");
      return;
    }

    setEditingId(null);
    setEditForm(emptyForm);
    await loadPlans();
  };

  const handleDelete = async (planId: number) => {
    if (!confirm("Delete this training plan?")) return;

    await fetch("/api/incharge/training-plan", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId }),
    });

    await loadPlans();
  };

  const togglePlanSelection = (planId: number) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId],
    );
  };

  const submitSelectedToAdmin = async () => {
    const selectedRecords = plans.filter((plan) =>
      selectedPlanIds.includes(plan.plan_id),
    );

    if (selectedRecords.length === 0) {
      alert("Please select at least one grid row");
      return;
    }

    const res = await fetch("/api/incharge/training-plan-authorization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: selectedRecords }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to send rows for admin authorization");
      return;
    }

    alert("Selected rows sent to admin authorization successfully");
    setSelectedPlanIds([]);
    await loadPlans();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800">
                Training Plan Entry
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Create and manage training plans for employees.
              </p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Training Plan
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 md:grid-cols-12"
          >
            <div className="md:col-span-12">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Training Plan Description
              </label>

              <select
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={formData.plan_desc}
                onChange={(e) =>
                  setFormData({ ...formData, plan_desc: e.target.value })
                }
                required
              >
                <option value="">Select Training Plan</option>
                {planHeadings.map((plan) => (
                  <option key={plan.plan_master_id} value={plan.plan_Heading}>
                    {plan.plan_Heading}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-6 lg:col-span-3">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Employee</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={formData.employee_id}
                onChange={(e) =>
                  setFormData({ ...formData, employee_id: e.target.value })
                }
                required
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.emp_code} value={emp.emp_code}>
                    {emp.emp_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-6 lg:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Year</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                placeholder="2026"
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: e.target.value })
                }
              />
            </div>

            <div className="md:col-span-6 lg:col-span-3">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Responsible Person</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={formData.responsible_person}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    responsible_person: e.target.value,
                  })
                }
              />
            </div>

            <div className="md:col-span-6 lg:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Target Completion Date</label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={formData.target_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    target_date: e.target.value,
                  })
                }
              />
            </div>

            <div className="md:col-span-6 lg:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Training Location</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                value={formData.training_location}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    training_location: e.target.value,
                  })
                }
                required
              >
                <option value="">Select Location</option>
                <option value="On Job">On Job</option>
                <option value="Internal">Internal</option>
                <option value="External">External</option>
              </select>
            </div>

            <div className="md:col-span-6 lg:col-span-3 lg:self-end">
              <button className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(37,99,235,0.38)]">
                Save Training Plan
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Training Plan List</h2>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Total: {plans.length}
              </span>
              {activeRole === "Incharge" ? (
                <button
                  type="button"
                  onClick={submitSelectedToAdmin}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Send Checked Rows To Admin Authorization
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                <tr className="text-center">
                  {activeRole === "Incharge" ? (
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Select</th>
                  ) : null}
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Plan</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Employee</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Responsible</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Target Date</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Location</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Year</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white text-center">
                {plans.length ? (
                  plans.map((plan) => (
                    <tr key={plan.plan_id} className="transition hover:bg-cyan-50/55">
                      {activeRole === "Incharge" ? (
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedPlanIds.includes(plan.plan_id)}
                            disabled={submittedPlanIds.includes(plan.plan_id)}
                            onChange={() => togglePlanSelection(plan.plan_id)}
                            className="h-4 w-4"
                          />
                          {submittedPlanIds.includes(plan.plan_id) ? (
                            <div className="mt-1 text-[11px] font-medium text-amber-600">
                              Pending
                            </div>
                          ) : null}
                        </td>
                      ) : null}

                      <td className="p-3">
                        {editingId === plan.plan_id ? (
                          <select
                            className="w-full rounded border px-2 py-1"
                            value={editForm.plan_desc}
                            onChange={(e) =>
                              setEditForm({ ...editForm, plan_desc: e.target.value })
                            }
                          >
                            <option value="">Select Training Plan</option>
                            {planHeadings.map((heading) => (
                              <option
                                key={heading.plan_master_id}
                                value={heading.plan_Heading}
                              >
                                {heading.plan_Heading}
                              </option>
                            ))}
                          </select>
                        ) : (
                          plan.plan_desc
                        )}
                      </td>

                      <td className="p-3">
                        {editingId === plan.plan_id ? (
                          <select
                            className="w-full rounded border px-2 py-1"
                            value={editForm.employee_id}
                            onChange={(e) =>
                              setEditForm({ ...editForm, employee_id: e.target.value })
                            }
                          >
                            <option value="">Select Employee</option>
                            {employees.map((emp) => (
                              <option key={emp.emp_code} value={emp.emp_code}>
                                {emp.emp_name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          plan.emp_name
                        )}
                      </td>

                      <td className="p-3">
                        {editingId === plan.plan_id ? (
                          <input
                            className="w-full rounded border px-2 py-1"
                            value={editForm.responsible_person}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                responsible_person: e.target.value,
                              })
                            }
                          />
                        ) : (
                          plan.responsible_person
                        )}
                      </td>

                      <td className="p-3">
                        {editingId === plan.plan_id ? (
                          <input
                            type="date"
                            className="w-full rounded border px-2 py-1"
                            value={editForm.target_date}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                target_date: e.target.value,
                              })
                            }
                          />
                        ) : (
                          plan.target_date?.split("T")[0]
                        )}
                      </td>

                      <td className="p-3">
                        {editingId === plan.plan_id ? (
                          <select
                            className="w-full rounded border px-2 py-1"
                            value={editForm.training_location}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                training_location: e.target.value,
                              })
                            }
                          >
                            <option value="">Select Location</option>
                            <option value="On Job">On Job</option>
                            <option value="Internal">Internal</option>
                            <option value="External">External</option>
                          </select>
                        ) : (
                          plan.training_location
                        )}
                      </td>

                      <td className="p-3">
                        {editingId === plan.plan_id ? (
                          <input
                            className="w-full rounded border px-2 py-1"
                            value={editForm.year}
                            onChange={(e) =>
                              setEditForm({ ...editForm, year: e.target.value })
                            }
                          />
                        ) : (
                          plan.year
                        )}
                      </td>

                      <td className="p-3 space-x-2">
                        {editingId === plan.plan_id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(plan.plan_id)}
                              className="rounded bg-green-600 px-3 py-1 text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="rounded bg-gray-500 px-3 py-1 text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(plan)}
                              className="rounded bg-blue-600 px-3 py-1 text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(plan.plan_id)}
                              className="rounded bg-red-600 px-3 py-1 text-white"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={activeRole === "Incharge" ? 8 : 7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No training plans found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
