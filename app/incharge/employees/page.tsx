"use client";

import { useEffect, useState } from "react";

interface Employee {
  emp_code: string;
  emp_name: string;
  designation: string;
  department: string;
  functional_area: string;
}

export default function InChargeEmployeesPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState<Employee>({
    emp_code: "",
    emp_name: "",
    designation: "",
    department: "",
    functional_area: "",
  });

  /* ================= LOAD EMPLOYEES ================= */
  const loadEmployees = async () => {
    const res = await fetch("/api/incharge/get_employees", {
      cache: "no-store",
    });
    const data = await res.json();
    console.log(data)
    setEmployees(data);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  /* ================= SAVE ================= */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

    /* ===== GRIDVIEW DUPLICATE CHECK (ONLY FOR ADD) ===== */
    if (!editingCode) {
      const alreadyInGrid = employees.some(
        (emp) => emp.emp_code === formData.emp_code,
      );

      if (alreadyInGrid) {
        alert("Employee Code already exists in the list!");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/incharge/get_employees", {
        method: editingCode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        alert("Failed to save employee");
        return;
      }

      await loadEmployees();

      setFormData({
        emp_code: "",
        emp_name: "",
        designation: "",
        department: "",
        functional_area: "",
      });

      setEditingCode(null); // ✅ reset edit mode
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 py-10">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-800">
            In-Charge → Employee Master
          </h1>
          <p className="text-slate-600 mt-1">
            Manage employee master data for training planning
          </p>
        </div>

        {/* Add Employee */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-12">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">
            ➕ Add Employee Details
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
          >
            {[
              { label: "Employee Code", name: "emp_code" },
              { label: "Employee Name", name: "emp_name" },
              { label: "Designation", name: "designation" },
              { label: "Department", name: "department" },
              { label: "Functional Area", name: "functional_area" },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  {field.label}
                </label>

                <input
                  name={field.name}
                  value={(formData as any)[field.name]}
                  onChange={async (e) => {
                    let value = e.target.value;

                    /* Employee Code numeric only + auto fetch */
                    if (field.name === "emp_code") {
                      value = value.replace(/\D/g, "");

                      setFormData((prev: any) => ({
                        ...prev,
                        emp_code: value,
                      }));

                      if (value.length >= 3) {
                        const res = await fetch(
                          `/api/incharge/get_employees?code=${value}`,
                        );

                        if (res.ok) {
                          const emp = await res.json();

                          setFormData({
                            emp_code: emp.emp_code || value,
                            emp_name: emp.emp_name || "",
                            designation: emp.designation || "",
                            department: emp.department || "",
                            functional_area: emp.functional_area || "",
                          });
                        }
                      }

                      return;
                    }

                    /* Employee Name letters only */
                    if (field.name === "emp_name") {
                      value = value.replace(/[^a-zA-Z\s]/g, "");
                    }

                    setFormData((prev: any) => ({
                      ...prev,
                      [field.name]: value,
                    }));
                  }}
                  className="w-full border rounded-lg px-3 py-2 text-sm
                             focus:ring-2 focus:ring-indigo-500 focus:outline-none
                             transition"
                  required
                />
              </div>
            ))}

            <div className="lg:col-span-5">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`mt-4 px-8 py-2 rounded-lg text-sm font-medium transition shadow
      ${
        isSubmitting
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-90"
      }`}
              >
                {isSubmitting ? "Saving..." : "💾 Save Employee"}
              </button>

              
            </div>
          </form>
        </div>

        {/* Employee List */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-4">📋 Employee List</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-left">
                  <th className="p-3">Emp Code</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Functional Area</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>

              <tbody>
                {employees.map((emp, index) => (
                  <tr key={index} className="border-b hover:bg-slate-50">
                    <td className="p-3 font-semibold">{emp.emp_code}</td>
                    <td className="p-3">{emp.emp_name}</td>
                    <td className="p-3">{emp.designation}</td>
                    <td className="p-3">{emp.department}</td>
                    <td className="p-3">{emp.functional_area}</td>
                    <td className="p-3 space-x-2">
                      <button
                        onClick={() => {
                          setEditingCode(emp.emp_code);
                          setFormData(emp);
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>

                      <button
                        onClick={async () => {
                          if (!confirm("Are you sure you want to delete?"))
                            return;

                          await fetch(
                            `/api/incharge/employees?emp_code=${emp.emp_code}`,
                            { method: "DELETE" },
                          );

                          loadEmployees();
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
