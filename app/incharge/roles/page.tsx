"use client";

import { useState } from "react";

export default function RolePage() {

  const [role, setRole] = useState("");

  const saveRole = async () => {

    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleDesc: role })
    });

    if (res.ok) {
      alert("Role Added");
      setRole("");
    }
  };

  return (
    <div style={{ padding: 30 }}>
      <h2>Add Role</h2>

      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Enter Role"
      />

      <button onClick={saveRole}>Save</button>
    </div>
  );
}