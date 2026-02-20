"use client";

import { useEffect, useState } from "react";

interface Role {
  Role_ID: number;
  Role_Desc: string;
}

interface Assigned {
  RAID: number;
  UserID: string;
  Role_Desc: string;
  CrDt: string;
}

export default function RoleAuthPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [assigned, setAssigned] = useState<Assigned[]>([]);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");

  /* LOAD ROLE MASTER */
  const loadRoles = async () => {
    const res = await fetch("/api/incharge/roles");
    const data = await res.json();
    setRoles(data);
  };

  /* LOAD ASSIGNED ROLES */
  const loadAssigned = async () => {
    const res = await fetch("/api/incharge/role-auth");
    const data = await res.json();
    setAssigned(data);
  };

  useEffect(() => {
    loadRoles();
    loadAssigned();
  }, []);

  /* SUBMIT */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/incharge/role-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        roleId: Number(roleId),
      }),
    });

    if (res.ok) {
      alert("Role assigned successfully");
      setUserId("");
      setRoleId("");
      loadAssigned();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-10">

      <div className="max-w-xl mx-auto bg-white shadow rounded-xl p-8">

        <h2 className="text-xl font-semibold mb-6">Assign Role</h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            placeholder="Employee Code"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />

          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full border p-2 rounded"
            required
          >
            <option value="">Select Role</option>
            {roles.map(r => (
              <option key={r.Role_ID} value={r.Role_ID}>
                {r.Role_Desc}
              </option>
            ))}
          </select>

          <button onClick={handleSubmit} className="w-full bg-blue-600 text-white p-2 rounded">
            Assign Role
          </button>

        </form>
      </div>

      {/* ROLE TABLE */}

      <div className="max-w-xl mx-auto mt-10 bg-white shadow rounded-xl p-8">

        <h3 className="text-lg font-semibold mb-4">Assigned Roles</h3>

        <table className="w-full border">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">User</th>
              <th className="p-2 border">Role</th>
              <th className="p-2 border">Created</th>
            </tr>
          </thead>

          <tbody>
            {assigned.map(a => (
              <tr key={a.RAID}>
                <td className="p-2 border">{a.UserID}</td>
                <td className="p-2 border">{a.Role_Desc}</td>
                <td className="p-2 border">
                  {new Date(a.CrDt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
}