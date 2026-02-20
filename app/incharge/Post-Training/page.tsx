"use client";

import { useEffect, useState } from "react";

export default function TrainingPlanPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    plan_desc: "",
    Id: "",
    year: "",
    responsible_person: "",
    target_date: "",
    Completion_date: "",
    training_location: "",

    effectiveness_desired: "",
    effectiveness_actual: "",
    gap_fulfilled: false,

    key_learnings: "",
    evidence_file: null as File | null,
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    const res = await fetch("/api/incharge/Post-Training");
    const data = await res.json();
    setPlans(data);
  };

  /* LOAD EMPLOYEES */
  useEffect(() => {
    fetch("/api/incharge/employees")
      .then((res) => res.json())
      .then(setEmployees);
  }, []);

  /* SUBMIT */
  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!formData.key_learnings || formData.key_learnings.trim() === "") {
    alert("Key Learnings is required");
    return;
  }

  const fd = new FormData();

  fd.append("plan_desc", formData.plan_desc);
  fd.append("employee_id", formData.Id);
  fd.append("year", formData.year);
  fd.append("responsible_person", formData.responsible_person);
  fd.append("target_date", formData.target_date);
   fd.append("Completion_date", formData.Completion_date);
  fd.append("training_location", formData.training_location);
  fd.append("effectiveness_desired", formData.effectiveness_desired);
  fd.append("effectiveness_actual", formData.effectiveness_actual);
  fd.append("gap_fulfilled", String(formData.gap_fulfilled));
  fd.append("key_learnings", formData.key_learnings);

  if (formData.evidence_file) {
    fd.append("file", formData.evidence_file);
  }

  const res = await fetch("/api/incharge/Post-Training", {
    method: "POST",
    body: fd,
  });

  const text = await res.text();
  console.log("RAW RESPONSE:", text);

  try {
    const json = JSON.parse(text);

    // ✅ SUCCESS POPUP (your message)
    alert("Employee post-training has been updated successfully ✅");

    // ✅ REFRESH DATA
    loadPlans();

    // ✅ CLEAR FORM (adjust if your structure differs)
    setFormData({
      plan_desc: "",
      Id: "",
      year: "",
      responsible_person: "",
      target_date: "",
      Completion_date:"",
      training_location: "",
      effectiveness_desired: "",
      effectiveness_actual: "",
      gap_fulfilled: false,
      key_learnings: "",
      evidence_file: null,
    });

  } catch (err) {
    alert("API ERROR – Check console");
  }
};

  const calculatedGap =
    Number(formData.effectiveness_desired || 0) -
    Number(formData.effectiveness_actual || 0);

  return (
  <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-8">
    
    {/* ================= FORM CARD ================= */}
    <div className="w-full bg-white mt-10 p-6 rounded-2xl shadow-xl border border-gray-200">
      
      <h2 className="text-2xl font-semibold text-gray-800 mb-6 border-b pb-3">
        Post-Training
      </h2>

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">

        {/* Reusable Input Style */}
        {/* Just UI improved, logic untouched */}

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Employee
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.Id}
            onChange={async (e) => {
              const empId = e.target.value;
              setFormData((prev) => ({ ...prev, Id: empId }));

              const res = await fetch(
                `/api/incharge/Post-Training/by-employee?empId=${empId}`
              );
              const data = await res.json();

              if (data) {
                setFormData((prev) => ({
                  ...prev,
                  Id: empId,
                  plan_desc: data.plan_desc || "",
                  year: data.year || "",
                  responsible_person: data.responsible_person || "",
                  target_date: data.target_date
                    ? data.target_date.split("T")[0]
                    : "",
                    Completion_date: data.Completion_date
                    ? data.Completion_date.split("T")[0]
                    : "",
                  training_location: data.training_location || "",
                }));
              }
            }}
          >
            <option value="">Select Employee</option>
            {employees.map((emp: any) => (
              <option key={emp.emp_code} value={emp.emp_code}>
                {emp.emp_name}
              </option>
            ))}
          </select>
        </div>

        {/* Plan Description */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Plan Description
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.plan_desc}
            onChange={(e) =>
              setFormData({ ...formData, plan_desc: e.target.value })
            }
          />
        </div>

        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Year
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.year}
            onChange={(e) =>
              setFormData({ ...formData, year: e.target.value })
            }
          />
        </div>

        {/* Responsible */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Responsible Person
          </label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.responsible_person}
            onChange={(e) =>
              setFormData({
                ...formData,
                responsible_person: e.target.value,
              })
            }
          />
        </div>

        {/* Target Date */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Target Date
          </label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.target_date}
            onChange={(e) =>
              setFormData({
                ...formData,
                target_date: e.target.value,
              })
            }
          />
        </div>


        {/* Actual Completion Date */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Actual Completion Date 
          </label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.Completion_date}
            onChange={(e) =>
              setFormData({
                ...formData,
                Completion_date: e.target.value,
              })
            }
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Training Location
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
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

        {/* Desired */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Effectiveness Desired
          </label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.effectiveness_desired}
            onChange={(e) =>
              setFormData({
                ...formData,
                effectiveness_desired: e.target.value,
              })
            }
          />
        </div>

        {/* Actual */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Effectiveness Actual
          </label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.effectiveness_actual}
            onChange={(e) =>
              setFormData({
                ...formData,
                effectiveness_actual: e.target.value,
              })
            }
          />
        </div>

        {/* Gap Fulfilled */}
        <div className="flex items-center gap-3 mt-6">
          <input
            type="checkbox"
            checked={formData.gap_fulfilled}
            onChange={(e) =>
              setFormData({
                ...formData,
                gap_fulfilled: e.target.checked,
              })
            }
            className="w-5 h-5 accent-indigo-600"
          />
          <span className="text-gray-700 font-medium">Gap Fulfilled</span>
        </div>

        {/* Gap */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Gap Identified
          </label>
          <input
            type="number"
            className="w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2"
            value={calculatedGap}
            readOnly
          />
        </div>

        {/* Remarks */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Key Learnings
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition"
            value={formData.key_learnings}
            onChange={(e) =>
              setFormData({
                ...formData,
                key_learnings: e.target.value,
              })
            }
          />
        </div>

        {/* File */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Evidence Upload
          </label>
          <input
            type="file"
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            onChange={(e) =>
              setFormData({
                ...formData,
                evidence_file: e.target.files?.[0] || null,
              })
            }
          />
        </div>

        {/* Button */}
        <div className="col-span-2 text-right mt-4">
          <button className="bg-indigo-600 hover:bg-indigo-700 transition text-white font-medium px-8 py-3 rounded-lg shadow-md hover:shadow-lg">
            Save Training Plan
          </button>
        </div>
      </form>
    </div>

    {/* ================= TABLE ================= */}
    <div className="w-full bg-white mt-10 p-6 rounded-2xl shadow-xl border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
        Training Plans List
      </h2>

      <div className="w-full overflow-x-auto">
        <table className="min-w-full text-sm table-auto">
          <thead>
            <tr className="bg-indigo-600 text-white">
              <th className="p-3">Employee</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Year</th>
              <th className="p-3">Responsible</th>
              <th className="p-3">Location</th>
              <th className="p-3">Desired</th>
              <th className="p-3">Actual</th>
              <th className="p-3">Gap</th>
              <th className="p-3">Fulfilled</th>
              <th className="p-3">key learnings</th>
              <th className="p-3">Evidence</th>
              <th className="p-3">Target Date</th>
              <th className="p-3">Completion Date</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>

          <tbody>
            {plans.map((plan) => (
              <tr
                key={plan.plan_id}
                className="border-b hover:bg-gray-50 transition text-center"
              >
                <td className="p-2">{plan.emp_name}</td>
                <td className="p-2">{plan.plan_desc}</td>
                <td className="p-2">{plan.year}</td>
                <td className="p-2">{plan.responsible_person}</td>
                <td className="p-2">{plan.training_location}</td>
                <td className="p-2">{plan.effectiveness_desired}</td>
                <td className="p-2">{plan.effectiveness_actual}</td>
                <td className="p-2">{plan.effectiveness_gap}</td>
                <td className="p-2">
                  {plan.gap_fulfilled ? "Yes" : "No"}
                </td>
                <td className="p-2">{plan.key_learnings}</td>
                <td className="p-2">
                  {plan.evidence_file ? (
                    <a
                      href={`/evidence/${plan.evidence_file}`}
                      target="_blank"
                      className="text-indigo-600 hover:underline"
                    >
                      View
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="p-2">{plan.target_date?.split("T")[0]}</td>
                <td className="p-2">{plan.Completion_date?.split("T")[0]}</td>
                <td className="p-2">{plan.created_at?.split("T")[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

  </div>
);
}
