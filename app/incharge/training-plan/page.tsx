"use client";

import { useCallback, useEffect, useState } from "react";

interface Employee {
  emp_code: string;
  emp_name: string;
}

interface Skill {
  skill_id: number;
  skill_name: string;
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
  plan_type: string | null;
  project_skill_names: string | null;
  plan_master_id?: number | null;
  status?: AuthorizationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

interface PlanMaster {
  plan_master_id: number;
  plan_Heading: string;
  skill_area_id?: number | null;
  skill_area_name?: string | null;
}

// Authorization status: nvarchar values (Pending, Approved, Rejected)
type AuthorizationStatus = "Pending" | "Approved" | "Rejected";

interface PlanWithAuth extends Plan {
  status?: AuthorizationStatus;
  display_status?: string; // String version for display (will use status directly)
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

type FormState = {
  plan_desc: string;
  employee_id: string;
  year: string;
  responsible_person: string;
  target_date: string;
  training_location: string;
  project_skill_names: string;
  plan_master_id?: string;
};

const emptyForm: FormState = {
  plan_desc: "",
  employee_id: "",
  year: "",
  responsible_person: "",
  target_date: "",
  training_location: "",
  project_skill_names: "",
  plan_master_id: undefined,
};

type PlanType = "Training" | "Project";

const getPlanType = (value: string | null | undefined): PlanType =>
  value === "Project" ? "Project" : "Training";

interface SkillArea {
  id: number;
  skill_area: string;
}

const parseSkillNames = (value: string | null | undefined): string[] =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function TrainingPlanPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillAreas, setSkillAreas] = useState<SkillArea[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planHeadings, setPlanHeadings] = useState<PlanMaster[]>([]);
  const [filteredPlanHeadings, setFilteredPlanHeadings] = useState<PlanMaster[]>([]);
  const [selectedSkillAreaId, setSelectedSkillAreaId] = useState<string>("");
  const [planType, setPlanType] = useState<PlanType>("Training");
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [selectedProjectSkillNames, setSelectedProjectSkillNames] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editSelectedProjectSkillNames, setEditSelectedProjectSkillNames] = useState<string[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );

  const loadPlans = useCallback(async () => {
    // Fetch all plans with their authorization status
    const res = await fetch("/api/incharge/training-plan?showAll=true", {
      cache: "no-store",
    });

    const data = await res.json();
    setPlans(Array.isArray(data) ? data : []);
  }, [planType]);

  // Filter plan headings based on selected skill area
  useEffect(() => {
    if (!selectedSkillAreaId || selectedSkillAreaId === "null" || selectedSkillAreaId === "") {
      setFilteredPlanHeadings(planHeadings);
      return;
    }
    const filtered = planHeadings.filter(
      (plan) => String(plan.skill_area_id || "") === selectedSkillAreaId
    );
    setFilteredPlanHeadings(filtered);
  }, [selectedSkillAreaId, planHeadings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/incharge/employees")
        .then((res) => res.json())
        .then((data) => setEmployees(Array.isArray(data) ? data : []));

      void fetch("/api/incharge/training-plan-master")
        .then((res) => res.json())
        .then((data) => {
          const plans = Array.isArray(data) ? data : [];
          setPlanHeadings(plans);
        });

      void fetch("/api/incharge/skill-areas")
        .then((res) => res.json())
        .then((data) => setSkillAreas(Array.isArray(data) ? data : []));

      void fetch("/api/incharge/skill-master")
        .then((res) => res.json())
        .then((data) => setSkills(Array.isArray(data) ? data : []));

      void loadPlans();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadPlans]);

  const modeLabel =
    planType === "Project" ? "Project Training Plan Entry" : "Training Plan Entry";
  const planLabel = planType === "Project" ? "Project Plan" : "Plan";
  const saveLabel =
    planType === "Project" ? "Save Project Training Plan" : "Save Training Plan";

  const setPlanMode = (nextType: PlanType) => {
    setPlanType(nextType);
    setFormData(emptyForm);
    setSelectedProjectSkillNames([]);
    setEditingId(null);
    setEditForm(emptyForm);
    setEditSelectedProjectSkillNames([]);
    setSelectedPlanIds([]);
    setSelectedSkillAreaId("");
  };

  const addProjectSkill = (skillId: number, isEdit: boolean) => {
    const selectedSkill = skills.find((skill) => skill.skill_id === skillId);
    if (!selectedSkill) return;

    const skillName = selectedSkill.skill_name;

    if (isEdit) {
      setEditSelectedProjectSkillNames((prev) => {
        if (prev.includes(skillName)) return prev;
        const next = [...prev, skillName];
        setEditForm((current) => ({
          ...current,
          project_skill_names: next.join(", "),
        }));
        return next;
      });
      return;
    }

    setSelectedProjectSkillNames((prev) => {
      if (prev.includes(skillName)) return prev;
      const next = [...prev, skillName];
      setFormData((current) => ({
        ...current,
        project_skill_names: next.join(", "),
      }));
      return next;
    });
  };

  const removeProjectSkill = (skillName: string, isEdit: boolean) => {
    if (isEdit) {
      setEditSelectedProjectSkillNames((prev) => {
        const next = prev.filter((name) => name !== skillName);
        setEditForm((current) => ({
          ...current,
          project_skill_names: next.join(", "),
        }));
        return next;
      });
      return;
    }

    setSelectedProjectSkillNames((prev) => {
      const next = prev.filter((name) => name !== skillName);
      setFormData((current) => ({
        ...current,
        project_skill_names: next.join(", "),
      }));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employee_id) {
      alert("Please select employee");
      return;
    }

    if (planType === "Project" && selectedProjectSkillNames.length === 0) {
      alert("Please select at least one skill for project training plan");
      return;
    }

    // Get skill_area_id from plan heading
    const planHeadingData = planHeadings.find(
      (p) => p.plan_Heading === formData.plan_desc
    );
    let skillAreaId: number | undefined;
    if (planHeadingData?.skill_area_id) {
      skillAreaId = planHeadingData.skill_area_id;
    }

    const res = await fetch("/api/incharge/training-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        plan_type: planType,
        project_skill_names:
          planType === "Project" ? selectedProjectSkillNames.join(", ") : "",
        skill_area_id: skillAreaId,
        plan_master_id: planHeadingData?.plan_master_id || undefined,
      }),
    });

    if (!res.ok) {
      alert("Something went wrong while saving");
      return;
    }

    alert("Training plan submitted successfully");
    setFormData(emptyForm);
    setSelectedProjectSkillNames([]);
    await loadPlans();
  };

  const startEdit = (plan: Plan) => {
    const normalizedType = getPlanType(plan.plan_type);
    const skillNames = parseSkillNames(plan.project_skill_names);

    // Set the skill area based on the plan heading first (for filtering)
    if (normalizedType !== planType) {
      setPlanType(normalizedType);
    }

    setEditingId(plan.plan_id);
    setEditForm({
      plan_desc: plan.plan_desc ?? "",
      employee_id: plan.employee_id ?? "",
      year: plan.year ?? "",
      responsible_person: plan.responsible_person ?? "",
      target_date: plan.target_date ? plan.target_date.split("T")[0] : "",
      training_location: plan.training_location ?? "",
      project_skill_names: skillNames.join(", "),
      plan_master_id: String(plan.plan_master_id ?? ""),
    });
    setEditSelectedProjectSkillNames(skillNames);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
    setEditSelectedProjectSkillNames([]);
  };

  const saveEdit = async (planId: number) => {
    if (planType === "Project" && editSelectedProjectSkillNames.length === 0) {
      alert("Please select at least one skill for project training plan");
      return;
    }

    // Get skill_area_id from plan heading
    const planHeadingData = planHeadings.find(
      (p) => p.plan_Heading === editForm.plan_desc
    );
    let skillAreaId: number | undefined;
    if (planHeadingData?.skill_area_id) {
      skillAreaId = planHeadingData.skill_area_id;
    }

    const res = await fetch("/api/incharge/training-plan", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: planId,
        ...editForm,
        plan_type: planType,
        project_skill_names:
          planType === "Project" ? editSelectedProjectSkillNames.join(", ") : "",
        skill_area_id: skillAreaId,
        plan_master_id: planHeadingData?.plan_master_id || undefined,
      }),
    });

    if (!res.ok) {
      alert("Failed to update training plan");
      return;
    }

    setEditingId(null);
    setEditForm(emptyForm);
    setEditSelectedProjectSkillNames([]);
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

  // Send selected plans to admin for approval
  const submitSelectedToAdmin = async () => {
    const selectedRecords = plans.filter((plan) =>
      selectedPlanIds.includes(plan.plan_id),
    );

    if (selectedRecords.length === 0) {
      alert("Please select at least one grid row");
      return;
    }

    // For each plan, send a PATCH request to update status to 'Pending'
    // Since all plans are already in TrainingPlan table, this just resets their status
    for (const record of selectedRecords) {
      await fetch("/api/incharge/training-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: record.plan_id, action: "pending" }),
      });
    }

    alert("Selected rows marked as pending for admin review");
    setSelectedPlanIds([]);
    await loadPlans();
  };

  const getStatusTextClass = (status: string | null) =>
    status === "Pending"
      ? "text-amber-600"
      : status === "Approved"
        ? "text-green-600"
        : status === "Rejected" ? "text-red-600" : "text-slate-400";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800">
                {modeLabel}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Create and manage {planType === "Project" ? "project " : ""}training plans for employees.
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setPlanMode("Training")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  planType === "Training"
                    ? "bg-cyan-600 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Training Plan
              </button>
              <button
                type="button"
                onClick={() => setPlanMode("Project")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  planType === "Project"
                    ? "bg-cyan-600 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Project Training Plan
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Skill Area & Plan Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">
                Step 1: Select Skill Area & Training Plan
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="skill_area_id" className="mb-2 block text-sm font-medium text-slate-700">
                    Skill Area *
                  </label>
                  <select
                    id="skill_area_id"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                    value={selectedSkillAreaId}
                    onChange={(e) => setSelectedSkillAreaId(e.target.value)}
                    required
                  >
                    <option value="">Select Skill Area</option>
                    {skillAreas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.skill_area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <div className="w-full rounded-lg border border-cyan-100 bg-cyan-50/80 px-4 py-3">
                    <p className="text-sm text-slate-700">
                      {selectedSkillAreaId ? (
                        <>
                          <span className="font-semibold text-cyan-700">{filteredPlanHeadings.length}</span>{" "}
                          plan{filteredPlanHeadings.length !== 1 && "s"} available
                        </>
                      ) : (
                        <span className="text-slate-500">Select a skill area to see available training plans</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Training Plan Name *
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                    value={formData.plan_desc}
                    onChange={(e) => {
                      const selectedPlan = filteredPlanHeadings.find((p) => p.plan_Heading === e.target.value);
                      setFormData({
                        ...formData,
                        plan_desc: selectedPlan?.plan_Heading || "",
                        plan_master_id: String(selectedPlan?.plan_master_id || ""),
                      });
                    }}
                    required
                  >
                    <option value="">Select Training Plan</option>
                    {filteredPlanHeadings.length === 0 && selectedSkillAreaId ? (
                      <option disabled>No plans available for this skill area</option>
                    ) : null}
                    {filteredPlanHeadings.map((plan) => (
                      <option key={plan.plan_master_id} value={plan.plan_Heading}>
                        {plan.plan_Heading}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 2: Plan Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">
                Step 2: Enter Plan Details
              </h3>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Employee Name *</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.emp_code} value={emp.emp_code}>
                        {emp.emp_name} ({emp.emp_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Year</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="2026"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Training Location *</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                    value={formData.training_location}
                    onChange={(e) => setFormData({ ...formData, training_location: e.target.value })}
                    required
                  >
                    <option value="">Select Location</option>
                    <option value="On Job">On Job</option>
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Responsible Person</label>
                  <input
                    type="text"
                    placeholder="Enter name"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                    value={formData.responsible_person}
                    onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Target Date</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                  />
                </div>
              </div>

              {planType === "Project" && (
                <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <label className="block text-sm font-medium text-slate-700">Skills (Select at least one)</label>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <button
                        key={skill.skill_id}
                        type="button"
                        onClick={() => addProjectSkill(skill.skill_id, false)}
                        className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-cyan-400 hover:bg-cyan-50"
                      >
                        + {skill.skill_name}
                      </button>
                    ))}
                  </div>
                  {selectedProjectSkillNames.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {selectedProjectSkillNames.map((skillName) => (
                        <span
                          key={skillName}
                          className="flex items-center gap-1.5 rounded-full bg-cyan-100 px-3 py-1.5 text-sm font-medium text-cyan-800"
                        >
                          {skillName}
                          <button
                            type="button"
                            onClick={() => removeProjectSkill(skillName, false)}
                            className="font-bold text-cyan-600 hover:text-cyan-900"
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {planType === "Project" ? "Save Project Training Plan" : "Save Training Plan"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-800">Training Plan List</h2>
            </div>

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
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">{planLabel}</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Employee</th>
                  {planType === "Project" ? (
                    <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Skill(s)</th>
                  ) : null}
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Responsible</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Target Date</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Location</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Year</th>
                  <th className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white text-center">
                {plans.length ? (
                  plans.map((plan) => {
                    // Authorization status is stored directly on the plan object (nvarchar: Pending, Approved, Rejected)
                    const authorizationStatus = plan.status || "Pending";
                    const isPendingAuthorization = authorizationStatus === "Pending";

                    return (
                      <tr key={plan.plan_id} className="transition hover:bg-cyan-50/55">
                      {activeRole === "Incharge" ? (
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedPlanIds.includes(plan.plan_id)}
                            disabled={!isPendingAuthorization}
                            onChange={() => togglePlanSelection(plan.plan_id)}
                            className="h-4 w-4"
                          />
                          {authorizationStatus && (
                            <div
                              className={`mt-1 text-[11px] font-medium ${getStatusTextClass(
                                authorizationStatus,
                              )}`}
                            >
                              {authorizationStatus}
                            </div>
                          )}
                        </td>
                      ) : null}

                      <td className="p-3">
                        {editingId === plan.plan_id ? (
                          <select
                            className="w-full rounded border px-2 py-1"
                            value={editForm.plan_master_id || ""}
                            onChange={(e) => {
                              const selectedPlan = filteredPlanHeadings.find(
                                (p) => String(p.plan_master_id) === e.target.value
                              );
                              setEditForm({
                                ...editForm,
                                plan_desc: selectedPlan?.plan_Heading || "",
                              });
                            }}
                          >
                            <option value="">Select Training Plan</option>
                            {filteredPlanHeadings.map((heading) => (
                              <option key={heading.plan_master_id} value={heading.plan_master_id}>
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

                      {planType === "Project" ? (
                        <td className="p-3">
                          {editingId === plan.plan_id ? (
                            <div className="space-y-2">
                              <select
                                className="w-full rounded border px-2 py-1"
                                value=""
                                onChange={(e) =>
                                  addProjectSkill(Number(e.target.value), true)
                                }
                              >
                                <option value="">Select Skill</option>
                                {skills.map((skill) => (
                                  <option key={skill.skill_id} value={skill.skill_id}>
                                    {skill.skill_name}
                                  </option>
                                ))}
                              </select>

                              {editSelectedProjectSkillNames.length > 0 ? (
                                <div className="flex flex-wrap gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-2">
                                  {editSelectedProjectSkillNames.map((skillName) => (
                                    <span
                                      key={skillName}
                                      className="flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700"
                                    >
                                      {skillName}
                                      <button
                                        type="button"
                                        onClick={() => removeProjectSkill(skillName, true)}
                                        className="font-bold text-red-600"
                                      >
                                        x
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            plan.project_skill_names || "-"
                          )}
                        </td>
                      ) : null}

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
                  );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={
                        7 +
                        (activeRole === "Incharge" ? 1 : 0) +
                        (planType === "Project" ? 1 : 0)
                      }
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No {planType === "Project" ? "project training plans" : "training plans"} found.
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
