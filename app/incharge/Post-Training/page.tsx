"use client";

import { useEffect, useState } from "react";

type Employee = {
  emp_code: string;
  emp_name: string;
};

type TrainingPlanOption = {
  plan_id: number;
  plan_desc: string;
  year: string;
  responsible_person: string;
  target_date: string;
  training_location: string;
};

type PostTrainingRecord = {
  row_key: string;
  plan_id: number;
  plan_desc: string;
  year: string;
  responsible_person: string;
  target_date: string;
  Completion_date: string;
  training_location: string;
  employee_id: string;
  emp_name: string;
  effectiveness_desired: number;
  effectiveness_actual: number;
  effectiveness_gap: number;
  gap_fulfilled: boolean;
  key_learnings: string;
  evidence_file: string | null;
  created_at: string;
};

type AuthorizationItem = {
  source_row_key: string | null;
  status: string;
};

type FormState = {
  plan_desc: string;
  employee_id: string;
  year: string;
  responsible_person: string;
  target_date: string;
  Completion_date: string;
  training_location: string;
  effectiveness_desired: string;
  effectiveness_actual: string;
  gap_fulfilled: boolean;
  key_learnings: string;
  evidence_file: File | null;
};

const emptyForm: FormState = {
  plan_desc: "",
  employee_id: "",
  year: "",
  responsible_person: "",
  target_date: "",
  Completion_date: "",
  training_location: "",
  effectiveness_desired: "",
  effectiveness_actual: "",
  gap_fulfilled: false,
  key_learnings: "",
  evidence_file: null,
};

export default function PostTrainingPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<PostTrainingRecord[]>([]);
  const [employeePlans, setEmployeePlans] = useState<TrainingPlanOption[]>([]);
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [submittedPlanIds, setSubmittedPlanIds] = useState<string[]>([]);
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );

  const loadPlans = async () => {
    const [plansRes, authorizationRes] = await Promise.all([
      fetch("/api/incharge/Post-Training", {
        cache: "no-store",
      }),
      fetch("/api/incharge/post-training-authorization", {
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
              Boolean(item.source_row_key),
          )
          .map((item: AuthorizationItem) => String(item.source_row_key))
      : [];

    setSubmittedPlanIds(pendingIds);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/incharge/employees")
        .then((res) => res.json())
        .then((data) => setEmployees(Array.isArray(data) ? data : []));

      void loadPlans();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const loadEmployeePlans = async (employeeId: string) => {
    if (!employeeId) {
      setEmployeePlans([]);
      return;
    }

    const res = await fetch(
      `/api/incharge/Post-Training/by-employee?empId=${employeeId}`,
    );
    const data = await res.json();
    setEmployeePlans(Array.isArray(data) ? data : []);
  };

  const buildFormData = (source: FormState, rowKey?: string) => {
    const fd = new FormData();

    if (rowKey) {
      fd.append("row_key", rowKey);
    }

    fd.append("plan_desc", source.plan_desc);
    fd.append("employee_id", source.employee_id);
    fd.append("year", source.year);
    fd.append("responsible_person", source.responsible_person);
    fd.append("target_date", source.target_date);
    fd.append("Completion_date", source.Completion_date);
    fd.append("training_location", source.training_location);
    fd.append("effectiveness_desired", source.effectiveness_desired);
    fd.append("effectiveness_actual", source.effectiveness_actual);
    fd.append("gap_fulfilled", String(source.gap_fulfilled));
    fd.append("key_learnings", source.key_learnings);

    if (source.evidence_file) {
      fd.append("file", source.evidence_file);
    }

    return fd;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.key_learnings.trim()) {
      alert("Key Learnings is required");
      return;
    }

    const res = await fetch("/api/incharge/Post-Training", {
      method: "POST",
      body: buildFormData(formData),
    });

    if (!res.ok) {
      alert("Something went wrong while saving");
      return;
    }

    alert("Employee post-training has been updated successfully");
    setFormData(emptyForm);
    setEmployeePlans([]);
    await loadPlans();
  };

  const startEdit = (plan: PostTrainingRecord) => {
    setEditingId(plan.row_key);
    setEditForm({
      plan_desc: plan.plan_desc ?? "",
      employee_id: plan.employee_id ?? "",
      year: plan.year ?? "",
      responsible_person: plan.responsible_person ?? "",
      target_date: plan.target_date ? plan.target_date.split("T")[0] : "",
      Completion_date: plan.Completion_date
        ? plan.Completion_date.split("T")[0]
        : "",
      training_location: plan.training_location ?? "",
      effectiveness_desired: String(plan.effectiveness_desired ?? ""),
      effectiveness_actual: String(plan.effectiveness_actual ?? ""),
      gap_fulfilled: Boolean(plan.gap_fulfilled),
      key_learnings: plan.key_learnings ?? "",
      evidence_file: null,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async (rowKey: string) => {
    const res = await fetch("/api/incharge/Post-Training", {
      method: "PUT",
      body: buildFormData(editForm, rowKey),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to update post-training record");
      return;
    }

    setEditingId(null);
    setEditForm(emptyForm);
    await loadPlans();
  };

  const handleDelete = async (rowKey: string) => {
    if (!confirm("Delete this post-training record?")) return;

    await fetch("/api/incharge/Post-Training", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row_key: rowKey }),
    });

    await loadPlans();
  };

  const togglePlanSelection = (rowKey: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(rowKey)
        ? prev.filter((id) => id !== rowKey)
        : [...prev, rowKey],
    );
  };

  const submitSelectedToAdmin = async () => {
    const selectedRecords = plans.filter((plan) =>
      selectedPlanIds.includes(plan.row_key),
    );

    if (selectedRecords.length === 0) {
      alert("Please select at least one grid row");
      return;
    }

    const res = await fetch("/api/incharge/post-training-authorization", {
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

  const calculatedGap =
    Number(formData.effectiveness_desired || 0) -
    Number(formData.effectiveness_actual || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8">
      <div className="mt-10 w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h2 className="mb-6 border-b pb-3 text-2xl font-semibold text-gray-800">
          Post-Training
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Employee
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={formData.employee_id}
              onChange={async (e) => {
                const employeeId = e.target.value;

                setFormData((prev) => ({
                  ...prev,
                  employee_id: employeeId,
                  plan_desc: "",
                  year: "",
                  responsible_person: "",
                  target_date: "",
                  Completion_date: "",
                  training_location: "",
                }));

                await loadEmployeePlans(employeeId);
              }}
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
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Plan Description
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={formData.plan_desc}
              onChange={(e) => {
                const selectedPlan = e.target.value;
                const planData = employeePlans.find(
                  (plan) => plan.plan_desc === selectedPlan,
                );

                setFormData((prev) => ({
                  ...prev,
                  plan_desc: selectedPlan,
                  year: planData?.year || "",
                  responsible_person: planData?.responsible_person || "",
                  target_date: planData?.target_date
                    ? planData.target_date.split("T")[0]
                    : "",
                  training_location: planData?.training_location || "",
                }));
              }}
            >
              <option value="">Select Training Plan</option>
              {employeePlans.map((plan) => (
                <option key={plan.plan_id} value={plan.plan_desc}>
                  {plan.plan_desc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Year
            </label>
            <input
              className="w-full rounded border px-3 py-2"
              value={formData.year}
              onChange={(e) =>
                setFormData({ ...formData, year: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Responsible Person
            </label>
            <input
              className="w-full rounded border px-3 py-2"
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
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Target Date
            </label>
            <input
              type="date"
              className="w-full rounded border px-3 py-2"
              value={formData.target_date}
              onChange={(e) =>
                setFormData({ ...formData, target_date: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Completion Date
            </label>
            <input
              type="date"
              className="w-full rounded border px-3 py-2"
              value={formData.Completion_date}
              onChange={(e) =>
                setFormData({ ...formData, Completion_date: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Training Location
            </label>
            <select
              className="w-full rounded border px-3 py-2"
              value={formData.training_location}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  training_location: e.target.value,
                })
              }
            >
              <option value="">Select</option>
              <option value="On Job">On Job</option>
              <option value="Internal">Internal</option>
              <option value="External">External</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Effectiveness Desired
            </label>
            <input
              type="number"
              className="w-full rounded border px-3 py-2"
              value={formData.effectiveness_desired}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  effectiveness_desired: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Effectiveness Actual
            </label>
            <input
              type="number"
              className="w-full rounded border px-3 py-2"
              value={formData.effectiveness_actual}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  effectiveness_actual: e.target.value,
                })
              }
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Effectiveness Gap
            </label>
            <input
              type="number"
              readOnly
              className="w-full rounded border bg-gray-100 px-3 py-2"
              value={calculatedGap}
            />
          </div>

          <div className="mt-6 flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.gap_fulfilled}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  gap_fulfilled: e.target.checked,
                })
              }
            />
            <label className="text-sm font-medium text-gray-600">
              Gap Fulfilled
            </label>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Key Learnings
            </label>
            <textarea
              className="w-full rounded border px-3 py-2"
              value={formData.key_learnings}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  key_learnings: e.target.value,
                })
              }
            />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-600">
              Upload Evidence File
            </label>
            <input
              type="file"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  evidence_file: e.target.files?.[0] || null,
                })
              }
            />
          </div>

          <div className="col-span-2 text-right">
            <button className="rounded bg-indigo-600 px-6 py-2 text-white">
              Save Training Plan
            </button>
          </div>
        </form>
      </div>

      <div className="mt-10 w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b pb-2">
          <h2 className="text-xl font-semibold text-gray-800">
            Post-Training List
          </h2>
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

        <div className="w-full overflow-x-auto">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr className="bg-indigo-600 text-white">
                {activeRole === "Incharge" ? (
                  <th className="p-3">Select</th>
                ) : null}
                <th className="p-3">Employee</th>
                <th className="p-3">Plan</th>
                <th className="p-3">Year</th>
                <th className="p-3">Responsible</th>
                <th className="p-3">Location</th>
                <th className="p-3">Desired</th>
                <th className="p-3">Actual</th>
                <th className="p-3">Gap</th>
                <th className="p-3">Fulfilled</th>
                <th className="p-3">Key Learnings</th>
                <th className="p-3">Evidence</th>
                <th className="p-3">Target Date</th>
                <th className="p-3">Completion Date</th>
                <th className="p-3">Created</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {plans.map((plan) => {
                const editGap =
                  Number(editForm.effectiveness_desired || 0) -
                  Number(editForm.effectiveness_actual || 0);

                return (
                  <tr
                    key={plan.row_key}
                    className="border-b text-center transition hover:bg-gray-50"
                  >
                    {activeRole === "Incharge" ? (
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedPlanIds.includes(plan.row_key)}
                          disabled={submittedPlanIds.includes(plan.row_key)}
                          onChange={() => togglePlanSelection(plan.row_key)}
                          className="h-4 w-4"
                        />
                        {submittedPlanIds.includes(plan.row_key) ? (
                          <div className="mt-1 text-[11px] font-medium text-amber-600">
                            Pending
                          </div>
                        ) : null}
                      </td>
                    ) : null}

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <select
                          className="w-full rounded border px-2 py-1"
                          value={editForm.employee_id}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              employee_id: e.target.value,
                            })
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

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={editForm.plan_desc}
                          onChange={(e) =>
                            setEditForm({ ...editForm, plan_desc: e.target.value })
                          }
                        />
                      ) : (
                        plan.plan_desc
                      )}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? (
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

                    <td className="p-2">
                      {editingId === plan.row_key ? (
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

                    <td className="p-2">
                      {editingId === plan.row_key ? (
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
                          <option value="">Select</option>
                          <option value="On Job">On Job</option>
                          <option value="Internal">Internal</option>
                          <option value="External">External</option>
                        </select>
                      ) : (
                        plan.training_location
                      )}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <input
                          type="number"
                          className="w-full rounded border px-2 py-1"
                          value={editForm.effectiveness_desired}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              effectiveness_desired: e.target.value,
                            })
                          }
                        />
                      ) : (
                        plan.effectiveness_desired
                      )}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <input
                          type="number"
                          className="w-full rounded border px-2 py-1"
                          value={editForm.effectiveness_actual}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              effectiveness_actual: e.target.value,
                            })
                          }
                        />
                      ) : (
                        plan.effectiveness_actual
                      )}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? editGap : plan.effectiveness_gap}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <input
                          type="checkbox"
                          checked={editForm.gap_fulfilled}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              gap_fulfilled: e.target.checked,
                            })
                          }
                        />
                      ) : plan.gap_fulfilled ? (
                        "Yes"
                      ) : (
                        "No"
                      )}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <textarea
                          className="w-full rounded border px-2 py-1"
                          value={editForm.key_learnings}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              key_learnings: e.target.value,
                            })
                          }
                        />
                      ) : (
                        plan.key_learnings
                      )}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <input
                          type="file"
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              evidence_file: e.target.files?.[0] || null,
                            })
                          }
                        />
                      ) : plan.evidence_file ? (
                        <a
                          href={`/evidence/${plan.evidence_file}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? (
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

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <input
                          type="date"
                          className="w-full rounded border px-2 py-1"
                          value={editForm.Completion_date}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              Completion_date: e.target.value,
                            })
                          }
                        />
                      ) : (
                        plan.Completion_date?.split("T")[0]
                      )}
                    </td>

                    <td className="p-2">{plan.created_at?.split("T")[0]}</td>

                    <td className="p-2 space-x-2">
                      {editingId === plan.row_key ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(plan.row_key)}
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
                            onClick={() => handleDelete(plan.row_key)}
                            className="rounded bg-red-600 px-3 py-1 text-white"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
