"use client";

import { useCallback, useEffect, useState } from "react";

interface Skill {
  skill_id: number;
  skill_name: string;
}

interface Employee {
  emp_code: string;
  emp_name: string;
}

interface RecordItem {
  id: number;
  skill_name: string;
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [submittedRecordIds, setSubmittedRecordIds] = useState<number[]>([]);
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );

  const [form, setForm] = useState({
    employee_id: "",
    desired_level: "",
    actual_level: "",
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    desired_level: "",
    actual_level: "",
  });

  const loadAll = useCallback(async () => {
    const mappingRes = await fetch("/api/incharge/training-plan-skill-mapping", {
      cache: "no-store",
    });

    const mappingData = await mappingRes.json();

    const shouldLoadAuthorization =
      activeRole === "Incharge" || activeRole === "Admin";
    const authorizationData = shouldLoadAuthorization
      ? await fetch("/api/incharge/skills-authorization", {
          cache: "no-store",
        }).then((res) => res.json())
      : [];

    setSkills(mappingData.skills ?? []);
    setEmployees(mappingData.employees ?? []);
    setRecords(mappingData.records ?? []);

    const pendingIds = Array.isArray(authorizationData)
      ? authorizationData
          .filter(
            (item: AuthorizationItem) =>
              item.status === "Pending" &&
              Number.isFinite(Number(item.source_mapping_id)),
          )
          .map((item: AuthorizationItem) => Number(item.source_mapping_id))
      : [];

    setSubmittedRecordIds(pendingIds);
  }, [activeRole]);

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
          desired_level: form.desired_level,
          actual_level: form.actual_level,
        }),
      });
    }

    alert("Employee skills have been added successfully");

    setSelectedSkills([]);
    setForm({
      employee_id: "",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 py-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="mb-6 text-2xl font-semibold text-slate-800">
            Training Plan - Skill Mapping
          </h1>

          <form
            onSubmit={submit}
            className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            <select
              required
              className="rounded-lg border px-4 py-2"
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

            <select
              className="rounded-lg border px-4 py-2"
              value=""
              onChange={(e) => {
                const id = Number(e.target.value);
                if (!id) return;

                const skill = skills.find((item) => item.skill_id === id);
                if (
                  skill &&
                  !selectedSkills.some(
                    (selected) => selected.skill_id === skill.skill_id,
                  )
                ) {
                  setSelectedSkills([...selectedSkills, skill]);
                }
              }}
            >
              <option value="">Select Skill</option>
              {skills.map((skill) => (
                <option key={skill.skill_id} value={skill.skill_id}>
                  {skill.skill_name}
                </option>
              ))}
            </select>

            {selectedSkills.length > 0 ? (
              <div className="rounded-lg border bg-slate-50 px-4 py-3 lg:col-span-3">
                <span className="text-sm font-semibold">Skills Selected:</span>

                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSkills.map((skill) => (
                    <span
                      key={skill.skill_id}
                      className="flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-700"
                    >
                      {skill.skill_name}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSkills((prev) =>
                            prev.filter(
                              (item) => item.skill_id !== skill.skill_id,
                            ),
                          )
                        }
                        className="font-bold text-red-600"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <input
              className="rounded-lg border px-4 py-2"
              placeholder="Desired Level"
              value={form.desired_level}
              onChange={(e) =>
                setForm({ ...form, desired_level: e.target.value })
              }
            />

            <input
              className="rounded-lg border px-4 py-2"
              placeholder="Actual Level"
              value={form.actual_level}
              onChange={(e) =>
                setForm({ ...form, actual_level: e.target.value })
              }
            />

            <div className="lg:col-span-3">
              <button className="rounded-lg bg-indigo-600 px-8 py-2 text-white">
                Add Skill Mapping
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-slate-800">
              Skill Mapping List
            </h2>

            {activeRole === "Incharge" ? (
              <button
                type="button"
                onClick={submitSelectedToAdmin}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white"
              >
                Send Checked Rows To Admin Authorization
              </button>
            ) : null}
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                {activeRole === "Incharge" ? (
                  <th className="p-4 text-center">Select</th>
                ) : null}
                <th className="p-4">Employee</th>
                <th className="p-4">Skill</th>
                <th className="p-4">Desired</th>
                <th className="p-4">Actual</th>
                <th className="p-4">Gap</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {records.map((record) => {
                const desired = Number(record.desired_level);
                const actual = Number(record.actual_level);
                const rawGap = desired - actual;
                const gap = Math.max(rawGap, 0);
                const gapClass =
                  rawGap > 0
                    ? "bg-red-100 text-red-700"
                    : rawGap === 0
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-800";

                return (
                  <tr key={record.id} className="border-b hover:bg-indigo-50/40">
                    {activeRole === "Incharge" ? (
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRecordIds.includes(record.id)}
                          disabled={submittedRecordIds.includes(record.id)}
                          onChange={() => toggleRecordSelection(record.id)}
                          className="h-4 w-4"
                        />
                        {submittedRecordIds.includes(record.id) ? (
                          <div className="mt-1 text-[11px] font-medium text-amber-600">
                            Pending
                          </div>
                        ) : null}
                      </td>
                    ) : null}

                    <td className="p-4">{record.emp_name}</td>
                    <td className="p-4">{record.skill_name}</td>

                    <td className="p-4">
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

                    <td className="p-4">
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

                    <td className="p-4">
                      <span
                        className={`${gapClass} rounded-full px-3 py-1 text-xs font-semibold`}
                      >
                        {gap}
                      </span>
                    </td>

                    <td className="p-4 text-center space-x-2">
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
