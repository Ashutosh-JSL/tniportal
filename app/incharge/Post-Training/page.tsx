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
  skill_area_id: number | null;
  skill_area_name: string | null;
  project_skill_names: string | null;
};

type PostTrainingRecord = {
  row_key: string;
  plan_id: number;
  source_plan_id: number | null;
  plan_desc: string;
  project_skill_names: string | null;
  skill_area_id: number | null;
  skill_area_name: string | null;
  target_outcome: string | null;
  actual_outcome: string | null;
  outcome_gap: number | null;
  year: string;
  responsible_person: string;
  target_date: string;
  Completion_date: string;
  training_location: string;
  employee_id: string;
  emp_name: string;
  effectiveness_desired: number | null;
  effectiveness_actual: number | null;
  effectiveness_gap: number | null;
  gap_fulfilled: boolean | null;
  key_learnings: string;
  evidence_file: string | null;
  created_at: string;
};

type AuthorizationItem = {
  source_row_key: string | null;
  status: string;
};

type FormState = {
  source_plan_id: string;
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
  project_skill_names: string;
  skill_area_id: string;
  skill_area_name: string;
  evidence_file: File | null;
};

const emptyForm: FormState = {
  source_plan_id: "",
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
  project_skill_names: "",
  skill_area_id: "",
  skill_area_name: "",
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
  const [authorizationStatusByRowKey, setAuthorizationStatusByRowKey] = useState<
    Record<string, string>
  >({});
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

    const nextStatusByRowKey: Record<string, string> = {};

    if (Array.isArray(authorizationData)) {
      for (const item of authorizationData as AuthorizationItem[]) {
        const key = String(item.source_row_key ?? "").trim();
        const status = String(item.status ?? "").trim();

        if (!key || !status) {
          continue;
        }

        if (!nextStatusByRowKey[key]) {
          nextStatusByRowKey[key] = status;
        }

        if (!key.startsWith("T|") && !key.startsWith("P|")) {
          const trainingPrefixedKey = `T|${key}`;
          if (!nextStatusByRowKey[trainingPrefixedKey]) {
            nextStatusByRowKey[trainingPrefixedKey] = status;
          }
        }
      }
    }

    setAuthorizationStatusByRowKey(nextStatusByRowKey);
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
      `/api/incharge/Post-Training/by-employee?empId=${encodeURIComponent(employeeId)}`,
      { cache: "no-store" },
    );
    const data = await res.json();

    if (!res.ok) {
      alert(data?.error ?? "Unable to load training plans for this employee");
      setEmployeePlans([]);
      return;
    }

    setEmployeePlans(Array.isArray(data) ? data : []);
  };

  const buildFormData = (source: FormState, rowKey?: string) => {
    const fd = new FormData();

    if (rowKey) {
      fd.append("row_key", rowKey);
    }

    fd.append("plan_desc", source.plan_desc);
    fd.append("source_plan_id", source.source_plan_id);
    fd.append("employee_id", source.employee_id);
    fd.append("year", source.year);
    fd.append("responsible_person", source.responsible_person);
    fd.append("target_date", source.target_date);
    fd.append("Completion_date", source.Completion_date);
    fd.append("training_location", source.training_location);
    fd.append("effectiveness_desired", source.effectiveness_desired);
    fd.append("effectiveness_actual", source.effectiveness_actual);
    fd.append("target_outcome", source.effectiveness_desired);
    fd.append("actual_outcome", source.effectiveness_actual);
    fd.append("gap_fulfilled", String(source.gap_fulfilled));
    fd.append("key_learnings", source.key_learnings);
    fd.append("project_skill_names", source.project_skill_names);
    fd.append("skill_area_id", source.skill_area_id);
    fd.append("skill_area_name", source.skill_area_name);

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
      source_plan_id: String(plan.source_plan_id ?? plan.plan_id ?? ""),
      plan_desc: plan.plan_desc ?? "",
      employee_id: plan.employee_id ?? "",
      year: plan.year ?? "",
      responsible_person: plan.responsible_person ?? "",
      target_date: plan.target_date ? plan.target_date.split("T")[0] : "",
      Completion_date: plan.Completion_date
        ? plan.Completion_date.split("T")[0]
        : "",
      training_location: plan.training_location ?? "",
      effectiveness_desired: String(plan.target_outcome ?? plan.effectiveness_desired ?? ""),
      effectiveness_actual: String(plan.actual_outcome ?? plan.effectiveness_actual ?? ""),
      gap_fulfilled: Boolean(plan.gap_fulfilled),
      key_learnings: plan.key_learnings ?? "",
      project_skill_names: plan.project_skill_names ?? "",
      skill_area_id: String(plan.skill_area_id ?? ""),
      skill_area_name: plan.skill_area_name ?? "",
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

  const getStatusTextClass = (status: string) =>
    status === "Pending"
      ? "text-amber-600"
      : status === "Approved"
        ? "text-green-600"
        : "text-red-600";

  const getNumericGap = (targetValue: string, actualValue: string) => {
    const target = Number(targetValue);
    const actual = Number(actualValue);

    if (!Number.isFinite(target) || !Number.isFinite(actual)) {
      return null;
    }

    return target - actual;
  };

  const calculatedGap = getNumericGap(
    formData.effectiveness_desired,
    formData.effectiveness_actual,
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800">
                Post-Training
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Capture post-training outcomes and evidence for employees.
              </p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Post-Training
            </div>
          </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Employee
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              value={formData.employee_id}
              onChange={async (e) => {
                const employeeId = e.target.value;

                setFormData((prev) => ({
                  ...prev,
                  source_plan_id: "",
                  employee_id: employeeId,
                  plan_desc: "",
                  year: "",
                  responsible_person: "",
                  target_date: "",
                  Completion_date: "",
                  training_location: "",
                  effectiveness_desired: "",
                  effectiveness_actual: "",
                  gap_fulfilled: false,
                  project_skill_names: "",
                  skill_area_id: "",
                  skill_area_name: "",
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Plan Description
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              value={formData.source_plan_id}
              onChange={(e) => {
                const selectedPlanId = Number(e.target.value);
                const planData = employeePlans.find(
                  (plan) => plan.plan_id === selectedPlanId,
                );

                setFormData((prev) => ({
                  ...prev,
                  source_plan_id: selectedPlanId ? String(selectedPlanId) : "",
                  plan_desc: planData?.plan_desc || "",
                  year: planData?.year || "",
                  responsible_person: planData?.responsible_person || "",
                  target_date: planData?.target_date
                    ? planData.target_date.split("T")[0]
                    : "",
                  training_location: planData?.training_location || "",
                  effectiveness_desired: "",
                  effectiveness_actual: "",
                  gap_fulfilled: false,
                  project_skill_names: planData?.project_skill_names ?? "",
                  skill_area_id: String(planData?.skill_area_id ?? ""),
                  skill_area_name: planData?.skill_area_name ?? "",
                }));
              }}
            >
              <option value="">Select Training Plan</option>
              {employeePlans.map((plan) => (
                <option key={plan.plan_id} value={plan.plan_id}>
                  {plan.plan_desc}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Skill Area
            </label>
            <input
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm"
              value={formData.skill_area_name || "-"}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Skill(s)
            </label>
            <input
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm"
              value={formData.project_skill_names || "-"}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Year
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              value={formData.year}
              onChange={(e) =>
                setFormData({ ...formData, year: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Responsible Person
            </label>
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

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Target Date
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              value={formData.target_date}
              onChange={(e) =>
                setFormData({ ...formData, target_date: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Completion Date
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              value={formData.Completion_date}
              onChange={(e) =>
                setFormData({ ...formData, Completion_date: e.target.value })
              }
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Training Location
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Target Outcome
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Actual Outcome
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Gap
            </label>
            <input
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm"
              value={calculatedGap ?? "-"}
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
            <label className="text-sm font-semibold text-slate-700">
              Gap Fulfilled
            </label>
          </div>

          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Key Learnings
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Upload Evidence File
            </label>
            <input
              type="file"
              className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  evidence_file: e.target.files?.[0] || null,
                })
              }
            />
          </div>

          <div className="col-span-2 text-right">
            <button className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(37,99,235,0.38)]">
              Save Training Plan
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            Post-Training List
          </h2>
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

        <div className="w-full overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="min-w-full table-auto text-sm">
            <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
              <tr className="text-slate-700">
                {activeRole === "Incharge" ? (
                  <th className="p-3 text-xs font-bold uppercase tracking-wider">Select</th>
                ) : null}
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Employee</th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">Plan</th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">Skill Area</th>
                <th className="p-3 text-left text-xs font-bold uppercase tracking-wider">Skill(s)</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Year</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Responsible</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Location</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Target Outcome</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Actual Outcome</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Gap</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Fulfilled</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Key Learnings</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Evidence</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Target Date</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Completion Date</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Created</th>
                <th className="p-3 text-xs font-bold uppercase tracking-wider">Action</th>
              </tr>
            </thead>

            <tbody>
              {plans.map((plan) => {
                const editGap = getNumericGap(
                  editForm.effectiveness_desired,
                  editForm.effectiveness_actual,
                );
                const authorizationStatus =
                  authorizationStatusByRowKey[plan.row_key];
                const isAuthorizationLocked =
                  authorizationStatus === "Pending" ||
                  authorizationStatus === "Approved";

                return (
                  <tr
                    key={plan.row_key}
                    className="border-b text-center align-top transition hover:bg-cyan-50/55"
                  >
                    {activeRole === "Incharge" ? (
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedPlanIds.includes(plan.row_key)}
                          disabled={isAuthorizationLocked}
                          onChange={() => togglePlanSelection(plan.row_key)}
                          className="h-4 w-4"
                        />
                        {authorizationStatus ? (
                          <div
                            className={`mt-1 text-[11px] font-medium ${getStatusTextClass(
                              authorizationStatus,
                            )}`}
                          >
                            {authorizationStatus}
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

                    <td className="p-2 text-left align-top">
                      {editingId === plan.row_key ? (
                        <input
                          className="w-full rounded border px-2 py-1"
                          value={editForm.plan_desc}
                          onChange={(e) =>
                            setEditForm({ ...editForm, plan_desc: e.target.value })
                          }
                        />
                      ) : (
                        <div className="max-w-[260px] whitespace-normal break-words">
                          {plan.plan_desc || "-"}
                        </div>
                      )}
                    </td>

                    <td className="p-2 text-left align-top">
                      {editingId === plan.row_key ? (
                        <input
                          readOnly
                          className="w-full rounded border bg-slate-100 px-2 py-1"
                          value={editForm.skill_area_name || "-"}
                        />
                      ) : (
                        <div className="max-w-[220px] whitespace-normal break-words">
                          {plan.skill_area_name || "-"}
                        </div>
                      )}
                    </td>

                    <td className="p-2 text-left align-top">
                      {editingId === plan.row_key ? (
                        <input
                          readOnly
                          className="w-full rounded border bg-slate-100 px-2 py-1"
                          value={editForm.project_skill_names || "-"}
                        />
                      ) : (
                        <div className="max-w-[240px] whitespace-normal break-words">
                          {plan.project_skill_names || "-"}
                        </div>
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
                          type="text"
                          className="w-full rounded border px-2 py-1"
                          value={editForm.effectiveness_desired}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              effectiveness_desired: e.target.value,
                            })
                          }
                        />
                      ) : plan.target_outcome ?? plan.effectiveness_desired ?? "-"}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <input
                          type="text"
                          className="w-full rounded border px-2 py-1"
                          value={editForm.effectiveness_actual}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              effectiveness_actual: e.target.value,
                            })
                          }
                        />
                      ) : plan.actual_outcome ?? plan.effectiveness_actual ?? "-"}
                    </td>

                    <td className="p-2">
                      {editingId === plan.row_key
                        ? editGap ?? "-"
                        : plan.outcome_gap ?? plan.effectiveness_gap ?? "-"}
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
                          href={`/attachments/${plan.evidence_file}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
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

                    <td className="p-2">
                      {editingId === plan.row_key ? (
                        <div className="inline-flex items-center gap-2 whitespace-nowrap">
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
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 whitespace-nowrap">
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
                        </div>
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
    </div>
  );
}

