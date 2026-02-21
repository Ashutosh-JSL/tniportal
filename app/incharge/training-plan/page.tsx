"use client";

import { useEffect, useState } from "react";

interface Employee {
  emp_code: string;
  emp_name: string;
}

interface Plan {
  plan_id: number;
  plan_desc: string;
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

export default function TrainingPlanPage() {

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planHeadings, setPlanHeadings] = useState<PlanMaster[]>([]);

  const [formData, setFormData] = useState({
    plan_desc: "",
    Id: "",
    year: "",
    responsible_person: "",
    target_date: "",
    training_location: "",
  });

  /* ================= DEBUG ================= */
  useEffect(() => {
    console.log("FORM STATE:", formData);
  }, [formData]);

  /* ================= LOAD GRID ================= */
  const loadPlans = async () => {
    const res = await fetch("/api/incharge/training-plan", {
      cache: "no-store",
    });
    const data = await res.json();
    setPlans(data);
  };

  /* ================= PAGE LOAD ================= */
  useEffect(() => {
    fetch("/api/incharge/employees")
      .then(res => res.json())
      .then(setEmployees);

    fetch("/api/incharge/training-plan-master")
      .then(res => res.json())
      .then(setPlanHeadings);

    loadPlans();
  }, []);

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.Id) {
      alert("Please select employee");
      return;
    }

    try {
      const payload = {
        plan_desc: formData.plan_desc,
        employee_id: formData.Id,
        year: formData.year,
        responsible_person: formData.responsible_person,
        target_date: formData.target_date,
        training_location: formData.training_location,
      };

      console.log("SENDING PAYLOAD:", payload);

      const res = await fetch("/api/incharge/training-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      alert("Training plan submitted successfully!");

      await loadPlans();

      setFormData({
        plan_desc: "",
        Id: "",
        year: "",
        responsible_person: "",
        target_date: "",
        training_location: "",
      });

    } catch (error) {
      console.error(error);
      alert("Something went wrong while saving");
    }
  };

  /* ================= DELETE ================= */
  const handleDelete = async (plan_id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;

    await fetch("/api/incharge/training-plan", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id }),
    });

    loadPlans();
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10">
      <div className="max-w-7xl mx-auto px-6">

        {/* ================= FORM ================= */}
        <div className="bg-white rounded-xl shadow p-8 mb-10">
          <h2 className="text-xl font-semibold mb-6">
            📘 Training Plan Entry
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >

            {/* ================= PLAN DESCRIPTION DROPDOWN ================= */}
            <div className="lg:col-span-3">
              <label className="text-sm font-medium">
                Training Plan Description
              </label>

              <select
                className="w-full border rounded px-4 py-2 mt-1"
                value={formData.plan_desc}
                onChange={e =>
                  setFormData({ ...formData, plan_desc: e.target.value })
                }
                required
              >
                <option value="">Select Training Plan</option>

                {planHeadings.map(plan => (
                  <option
                    key={plan.plan_master_id}
                    value={plan.plan_Heading}
                  >
                    {plan.plan_Heading}
                  </option>
                ))}
              </select>
            </div>

            {/* ================= EMPLOYEE ================= */}
            <div>
              <label className="text-sm font-medium">Employee</label>

              <select
                className="w-full border rounded px-4 py-2 mt-1"
                value={formData.Id}
                onChange={e =>
                  setFormData({ ...formData, Id: e.target.value })
                }
                required
              >
                <option value="">Select Employee</option>

                {employees.map(emp => (
                  <option key={emp.emp_code} value={emp.emp_code}>
                    {emp.emp_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="text-sm font-medium">Year</label>
              <input
                className="w-full border rounded px-4 py-2 mt-1"
                placeholder="2026"
                value={formData.year}
                onChange={e =>
                  setFormData({ ...formData, year: e.target.value })
                }
              />
            </div>

            {/* Responsible */}
            <div>
              <label className="text-sm font-medium">
                Responsible Person
              </label>
              <input
                className="w-full border rounded px-4 py-2 mt-1"
                value={formData.responsible_person}
                onChange={e =>
                  setFormData({
                    ...formData,
                    responsible_person: e.target.value,
                  })
                }
              />
            </div>

            {/* Target Date */}
            <div>
              <label className="text-sm font-medium">
                Target Completion Date
              </label>
              <input
                type="date"
                className="w-full border rounded px-4 py-2 mt-1"
                value={formData.target_date}
                onChange={e =>
                  setFormData({
                    ...formData,
                    target_date: e.target.value,
                  })
                }
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-sm font-medium">
                Training Location
              </label>

              <select
                className="w-full border rounded px-4 py-2 mt-1"
                value={formData.training_location}
                onChange={e =>
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
              <button className="bg-indigo-600 text-white px-8 py-2 rounded">
                ➕ Save Training Plan
              </button>
            </div>

          </form>
        </div>

        {/* ================= GRID ================= */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            📋 Training Plan List
          </h2>

          <table className="w-full text-sm border">
            <thead className="bg-slate-100 text-center">
              <tr>
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
              {plans.map(p => (
                <tr key={p.plan_id} className="border-t">
                  <td className="p-3">{p.plan_desc}</td>
                  <td className="p-3">{p.emp_name}</td>
                  <td className="p-3">{p.responsible_person}</td>
                  <td className="p-3">{p.target_date?.split("T")[0]}</td>
                  <td className="p-3">{p.training_location}</td>
                  <td className="p-3">{p.year}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDelete(p.plan_id)}
                      className="text-red-600 hover:underline"
                    >
                      🗑 Delete
                    </button>
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