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
    <div className="min-h-screen bg-slate-100 py-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 rounded-xl bg-white p-8 shadow">
          <h2 className="mb-6 text-xl font-semibold">
            Training Plan Entry
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            <div className="lg:col-span-3">
              <label className="text-sm font-medium">
                Training Plan Description
              </label>

              <select
                className="mt-1 w-full rounded border px-4 py-2"
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

            <div>
              <label className="text-sm font-medium">Employee</label>
              <select
                className="mt-1 w-full rounded border px-4 py-2"
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

            <div>
              <label className="text-sm font-medium">Year</label>
              <input
                className="mt-1 w-full rounded border px-4 py-2"
                placeholder="2026"
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">Responsible Person</label>
              <input
                className="mt-1 w-full rounded border px-4 py-2"
                value={formData.responsible_person}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    responsible_person: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">Target Completion Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded border px-4 py-2"
                value={formData.target_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    target_date: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">Training Location</label>
              <select
                className="mt-1 w-full rounded border px-4 py-2"
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

            <div className="lg:col-span-3">
              <button className="rounded bg-indigo-600 px-8 py-2 text-white">
                Save Training Plan
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold">Training Plan List</h2>

            {activeRole === "Incharge" ? (
              <button
                type="button"
                onClick={submitSelectedToAdmin}
                className="rounded bg-emerald-600 px-5 py-2 text-sm font-medium text-white"
              >
                Send Checked Rows To Admin Authorization
              </button>
            ) : null}
          </div>

          <table className="w-full border border-collapse text-sm">
            <thead className="bg-slate-100 text-center">
              <tr>
                {activeRole === "Incharge" ? (
                  <th className="p-3">Select</th>
                ) : null}
                <th className="p-3">Plan</th>
                <th className="p-3">Employee</th>
                <th className="p-3">Responsible</th>
                <th className="p-3">Target Date</th>
                <th className="p-3">Location</th>
                <th className="p-3">Year</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody className="text-center">
              {plans.map((plan) => (
                <tr key={plan.plan_id} className="border-t">
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
