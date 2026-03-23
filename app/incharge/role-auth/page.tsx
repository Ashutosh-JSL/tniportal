"use client";

import { useEffect, useState } from "react";

interface Role {
  Role_ID: number;
  Role_Desc: string;
}

interface Assigned {
  RAID: number;
  UserID: string;
  Full_Name?: string;
  Role_ID?: number | null;
  Role_Desc: string;
  CrDt: string;
}

export default function RoleAuthPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [assigned, setAssigned] = useState<Assigned[]>([]);
  const [assignedError, setAssignedError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRaid, setEditingRaid] = useState<number | null>(null);
  const [editingRoleId, setEditingRoleId] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingRaid, setDeletingRaid] = useState<number | null>(null);

  /* LOAD ROLE MASTER */
  const loadRoles = async () => {
    try {
      const res = await fetch("/api/incharge/roles", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      setRoles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load roles:", error);
      setRoles([]);
    }
  };

  /* LOAD ASSIGNED ROLES */
  const loadAssigned = async () => {
    try {
      const res = await fetch("/api/incharge/role-auth", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          (data && typeof data === "object" && "error" in data && typeof data.error === "string" && data.error) ||
          "Failed to load assigned roles";
        setAssigned([]);
        setAssignedError(message);
        return;
      }

      const normalizedData = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : [];
      setAssigned(normalizedData);
      setAssignedError(null);
    } catch (error) {
      console.error("Failed to load assigned roles:", error);
      setAssigned([]);
      setAssignedError("Failed to load assigned roles");
    }
  };

  useEffect(() => {
    loadRoles();
    loadAssigned();
  }, []);

  /* SUBMIT */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/incharge/role-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          roleId: Number(roleId),
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        alert(data?.message ?? "Role assigned successfully");
        setUserId("");
        setRoleId("");
        await loadAssigned();
        return;
      }

      alert(data?.error ?? "Failed to assign role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (row: Assigned) => {
    setEditingRaid(row.RAID);
    setEditingRoleId(row.Role_ID ? String(row.Role_ID) : "");
  };

  const cancelEdit = () => {
    setEditingRaid(null);
    setEditingRoleId("");
  };

  const saveEdit = async (raid: number) => {
    if (isUpdating) return;

    const nextRoleId = Number(editingRoleId);
    if (!Number.isFinite(nextRoleId) || !nextRoleId) {
      alert("Please select a valid role");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch("/api/incharge/role-auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raid, roleId: nextRoleId }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error ?? "Failed to update role assignment");
        return;
      }

      alert(data?.message ?? "Role assignment updated successfully");
      cancelEdit();
      await loadAssigned();
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteAssignment = async (raid: number) => {
    if (deletingRaid === raid) return;
    if (!confirm("Delete this role assignment?")) return;

    setDeletingRaid(raid);
    try {
      const res = await fetch("/api/incharge/role-auth", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raid }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error ?? "Failed to delete role assignment");
        return;
      }

      alert(data?.message ?? "Role assignment deleted successfully");
      if (editingRaid === raid) {
        cancelEdit();
      }
      await loadAssigned();
    } finally {
      setDeletingRaid(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800">Assign Role</h2>
              <p className="mt-1 text-sm text-slate-600">Map employee codes with system roles quickly and securely.</p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Role Authorization
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <label htmlFor="employeeCode" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Employee Code
              </label>
              <input
                id="employeeCode"
                placeholder="Enter employee code"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                required
              />
            </div>

            <div className="md:col-span-4">
              <label htmlFor="roleSelect" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Role
              </label>
              <select
                id="roleSelect"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                required
              >
                <option value="">Select Role</option>
                {roles.map((r) => (
                  <option key={r.Role_ID} value={r.Role_ID}>
                    {r.Role_Desc}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 md:self-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(37,99,235,0.38)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Assign Role"
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-bold tracking-tight text-slate-800">Assigned Roles</h3>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Total: {assigned.length}
            </span>
          </div>
          {assignedError ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {assignedError}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Employee Code</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Employee Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Created</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {assigned.length ? (
                  assigned.map((a) => (
                    <tr key={a.RAID} className="transition hover:bg-cyan-50/55">
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">{a.UserID}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{a.Full_Name || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        {editingRaid === a.RAID ? (
                          <select
                            value={editingRoleId}
                            onChange={(e) => setEditingRoleId(e.target.value)}
                            className="w-full min-w-[170px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                          >
                            <option value="">Select Role</option>
                            {roles.map((r) => (
                              <option key={r.Role_ID} value={r.Role_ID}>
                                {r.Role_Desc}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                            {a.Role_Desc}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{new Date(a.CrDt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        {editingRaid === a.RAID ? (
                          <div className="inline-flex items-center gap-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => saveEdit(a.RAID)}
                              disabled={isUpdating}
                              className="rounded bg-green-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-70"
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
                              onClick={() => startEdit(a)}
                              className="rounded bg-blue-600 px-3 py-1 text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteAssignment(a.RAID)}
                              disabled={deletingRaid === a.RAID}
                              className="rounded bg-red-600 px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {deletingRaid === a.RAID ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      No roles assigned yet.
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
