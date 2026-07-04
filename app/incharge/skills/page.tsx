"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";

interface Skill {
  skill_id: number;
  skill_name: string;
  skill_area_id: number | null;
  skill_area: string | null;
  approval_status?: "Pending" | "Approved" | "Rejected";
}

interface Employee {
  emp_code: string;
  emp_name: string;
}

interface SkillArea {
  id: number;
  skill_area: string;
}

interface RecordItem {
  id: number;
  skill_name: string;
  skill_area: string | null;
  emp_code: string;
  emp_name: string;
  desired_level: number;
  actual_level: number;
  gap: number;
}

interface AuthorizationItem {
  source_mapping_id: number | null;
  status: string;
}

export default function TrainingPlanSkillPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillAreas, setSkillAreas] = useState<SkillArea[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [authorizationStatusByRecordId, setAuthorizationStatusByRecordId] =
    useState<Record<number, string>>({});
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );

  const [form, setForm] = useState({
    employee_id: "",
    skill_area_id: "",
    desired_level: "",
    actual_level: "",
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    desired_level: "",
    actual_level: "",
  });

  const loadAll = useCallback(async () => {
    const shouldLoadAuthorization =
      activeRole === "Incharge" || activeRole === "Admin";

    const [mappingData, skillMasterData, authorizationData] = await Promise.all([
      fetch("/api/incharge/training-plan-skill-mapping", {
        cache: "no-store",
      }).then((res) => res.json()),
      fetch("/api/incharge/skill-master?includeAll=true&includeAreas=true", {
        cache: "no-store",
      }).then((res) => res.json()),
      shouldLoadAuthorization
        ? fetch("/api/incharge/skills-authorization", {
            cache: "no-store",
          }).then((res) => res.json())
        : Promise.resolve([]),
    ]);

    setSkills(Array.isArray(skillMasterData?.skills) ? skillMasterData.skills : []);
    setSkillAreas(
      Array.isArray(skillMasterData?.skillAreas) ? skillMasterData.skillAreas : [],
    );
    setEmployees(mappingData.employees ?? []);
    setRecords(mappingData.records ?? []);

    const nextStatusByRecordId: Record<number, string> = {};

    if (Array.isArray(authorizationData)) {
      for (const item of authorizationData as AuthorizationItem[]) {
        const sourceRecordId = Number(item.source_mapping_id);
        if (!Number.isFinite(sourceRecordId) || nextStatusByRecordId[sourceRecordId]) {
          continue;
        }

        const status = String(item.status ?? "").trim();
        if (!status) {
          continue;
        }

        nextStatusByRecordId[sourceRecordId] = status;
      }
    }

    setAuthorizationStatusByRecordId(nextStatusByRecordId);
  }, [activeRole]);

  const filteredSkills = useMemo(() => {
    const selectedAreaId = Number(form.skill_area_id);

    if (!Number.isFinite(selectedAreaId) || selectedAreaId === 0) {
      return [];
    }

    return skills.filter((skill) => Number(skill.skill_area_id) === selectedAreaId);
  }, [form.skill_area_id, skills]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAll();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAll]);

  const startEdit = (record: RecordItem) => {
    setEditingId(record.id);
    setEditForm({
      desired_level: String(record.desired_level),
      actual_level: String(record.actual_level),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number) => {
    await fetch("/api/incharge/training-plan-skill-mapping", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        desired_level: Number(editForm.desired_level),
        actual_level: Number(editForm.actual_level),
      }),
    });

    setEditingId(null);
    loadAll();
  };

  const deleteRecord = async (id: number) => {
    const ok = confirm("Delete this skill mapping?");
    if (!ok) return;

    await fetch("/api/incharge/training-plan-skill-mapping", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    loadAll();
  };

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
          emp_code: form.employee_id,
          skill_id: skill.skill_id,
          skill_area_id: Number(form.skill_area_id),
          desired_level: form.desired_level,
          actual_level: form.actual_level,
        }),
      });
    }

    alert("Employee skills have been added successfully");

    setSelectedSkills([]);
    setForm({
      employee_id: "",
      skill_area_id: "",
      desired_level: "",
      actual_level: "",
    });

    loadAll();
  };

  const toggleRecordSelection = (id: number) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id)
        ? prev.filter((recordId) => recordId !== id)
        : [...prev, id],
    );
  };

  const submitSelectedToAdmin = async () => {
    const selectedRecords = records.filter((record) =>
      selectedRecordIds.includes(record.id),
    );

    if (selectedRecords.length === 0) {
      alert("Please select at least one grid row");
      return;
    }

    const res = await fetch("/api/incharge/skills-authorization", {
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
    setSelectedRecordIds([]);
    loadAll();
  };

  const getStatusTextClass = (status: string) =>
    status === "Pending"
      ? "text-amber-600"
      : status === "Approved"
        ? "text-green-600"
        : "text-red-600";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                Training Plan - Skill Mapping
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Map employee skills with desired and actual levels.
              </p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Skill Mapping
            </div>
          </div>

          <form onSubmit={submit} className="space-y-6">
            {/* Employee & Skill Area Row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              <div className="md:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Employee
                </label>
                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
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
              </div>

              <div className="md:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Skill Area
                </label>
                <select
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  value={form.skill_area_id}
                  onChange={(e) => {
                    setForm({ ...form, skill_area_id: e.target.value });
                    setSelectedSkills([]);
                  }}
                >
                  <option value="">Select Skill Area</option>
                  {skillAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.skill_area}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-4">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Skill
                </label>
                <Select
                  isDisabled={!form.skill_area_id}
                  className="react-select-custom"
                  classNamePrefix="react-select"
                  placeholder={
                    form.skill_area_id
                      ? "Search and select skill..."
                      : "Select Skill Area first"
                  }
                  options={filteredSkills.map((skill) => ({
                    value: skill.skill_id,
                    label: skill.skill_name,
                  }))}
                  onChange={(option) => {
                    const id = option?.value;
                    if (!id) return;

                    const skill = filteredSkills.find(
                      (item) => item.skill_id === id
                    );

                    if (
                      skill &&
                      !selectedSkills.some(
                        (selected) => selected.skill_id === skill.skill_id
                      )
                    ) {
                      setSelectedSkills([...selectedSkills, skill]);
                    }
                  }}
                  isClearable
                  noOptionsMessage={() => "No skills found"}
                  menuPortalTarget={document.body}
                  menuPosition="fixed"
                  styles={{
                    control: (base) => ({
                      ...base,
                      minHeight: "52px",
                      border: form.skill_area_id ? "1px solid #cbd5e1" : "1px solid #f1f5f9",
                      backgroundColor: form.skill_area_id ? "#ffffff" : "#f8fafc",
                    }),
                    menu: (base) => ({
                      ...base,
                      marginTop: "4px",
                      zIndex: 9999,
                      marginBottom: "24px",
                      borderRadius: "12px",
                      overflow: "hidden",
                    }),
                  }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Levels
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForm({
                      ...form,
                      desired_level: "",
                      actual_level: "",
                    });
                  }}
                  className="w-full rounded-xl border border-dashed border-cyan-300 bg-cyan-50/50 px-4 py-3 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50"
                >
                  Reset Levels
                </button>
              </div>
            </div>

            {/* Skills Selected Display */}
            {selectedSkills.length > 0 && (
              <div className="animate-fade-in rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-cyan-50 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-sm font-bold text-indigo-900">
                      Selected Skills ({selectedSkills.length})
                    </span>
                    <p className="mt-1 text-xs text-indigo-700/80">
                      Review your selections before adding
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSkills([])}
                    className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    Clear all
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedSkills.map((skill) => (
                    <span
                      key={skill.skill_id}
                      className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-inset ring-indigo-100 transition hover:shadow-md"
                    >
                      {skill.skill_name}
                      {skill.skill_area ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                          {skill.skill_area}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSkills((prev) =>
                            prev.filter(
                              (item) => item.skill_id !== skill.skill_id,
                            ),
                          )
                        }
                        className="flex items-center justify-center rounded-lg p-1 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Level Inputs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Desired Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required={selectedSkills.length > 0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 placeholder:text-slate-400"
                  placeholder="Enter desired level (1-10)"
                  value={form.desired_level}
                  onChange={(e) =>
                    setForm({ ...form, desired_level: e.target.value })
                  }
                />
              </div>

              <div className="sm:col-span-5">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Actual Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required={selectedSkills.length > 0}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 placeholder:text-slate-400"
                  placeholder="Enter actual level (1-10)"
                  value={form.actual_level}
                  onChange={(e) =>
                    setForm({ ...form, actual_level: e.target.value })
                  }
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  disabled={selectedSkills.length === 0}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-200 transition hover:-translate-y-1 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Add Mapping
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-bold tracking-tight text-slate-800">
              Skill Mapping List
            </h2>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Total: {records.length}
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
                <tr className="text-left">
                  {activeRole === "Incharge" ? (
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Select</th>
                  ) : null}
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Employee</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Skill Area</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Skill</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Desired</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Actual</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Gap</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {records.length ? (
                  records.map((record) => {
                    const desired = Number(record.desired_level);
                    const actual = Number(record.actual_level);
                    const rawGap = desired - actual;
                    const gap = Math.max(rawGap, 0);
                    const authorizationStatus =
                      authorizationStatusByRecordId[record.id];
                    const gapClass =
                      rawGap > 0
                        ? "bg-red-100 text-red-700"
                        : rawGap === 0
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-800";

                    return (
                      <tr key={record.id} className="transition hover:bg-cyan-50/55">
                        {activeRole === "Incharge" ? (
                          <td className="px-4 py-3 text-center">
                            {authorizationStatus ? (
                              <div
                                className={`text-[11px] font-medium ${getStatusTextClass(
                                  authorizationStatus,
                                )}`}
                              >
                                {authorizationStatus}
                              </div>
                            ) : (
                              <input
                                type="checkbox"
                                checked={selectedRecordIds.includes(record.id)}
                                onChange={() => toggleRecordSelection(record.id)}
                                className="h-4 w-4"
                              />
                            )}
                          </td>
                        ) : null}

                        <td className="px-4 py-3 text-slate-700">{record.emp_name}</td>
                        <td className="px-4 py-3 text-slate-700">{record.skill_area || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{record.skill_name}</td>

                        <td className="px-4 py-3">
                          {editingId === record.id ? (
                            <input
                              className="w-20 rounded border px-2 py-1"
                              value={editForm.desired_level}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  desired_level: e.target.value,
                                })
                              }
                            />
                          ) : (
                            record.desired_level
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {editingId === record.id ? (
                            <input
                              className="w-20 rounded border px-2 py-1"
                              value={editForm.actual_level}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  actual_level: e.target.value,
                                })
                              }
                            />
                          ) : (
                            record.actual_level
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`${gapClass} rounded-full px-3 py-1 text-xs font-semibold`}
                          >
                            {gap}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-2">
                            {editingId === record.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(record.id)}
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
                                  onClick={() => startEdit(record)}
                                  className="rounded bg-blue-600 px-3 py-1 text-white"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRecord(record.id)}
                                  className="rounded bg-red-600 px-3 py-1 text-white"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={activeRole === "Incharge" ? 8 : 7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No skill mappings found.
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
