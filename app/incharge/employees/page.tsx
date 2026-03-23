"use client";

import { useEffect, useState } from "react";

/* ================= INTERFACE ================= */
interface Employee {
  emp_code: string;
  emp_name: string;
  designation: string;
  department: string;
  functional_area: string;
  Direct_Manager_Name: string;
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
    Direct_Manager_Name: "",
  });

  /* ================= LOAD EMPLOYEES ================= */
  const loadEmployees = async () => {
    const res = await fetch("/api/incharge/get_employees", {
      cache: "no-store",
    });
    const data = await res.json();
    console.log("EMP LIST:", data);
    setEmployees(data);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  /* ================= SAVE ================= */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSubmitting) return;

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

      const data = await res.json();

      alert("Employee data submitted successfully");

      await loadEmployees();

      setFormData({
        emp_code: "",
        emp_name: "",
        designation: "",
        department: "",
        functional_area: "",
        Direct_Manager_Name: "",
      });

      setEditingCode(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                In-Charge Employee Master
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage employee master data for training planning.
              </p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Employee Management
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-12">
            {[
              { label: "Employee Code", name: "emp_code" },
              { label: "Employee Name", name: "emp_name" },
              { label: "Designation", name: "designation" },
              { label: "Department", name: "department" },
              { label: "Functional Area", name: "functional_area" },
              { label: "Direct Manager", name: "Direct_Manager_Name" },
            ].map((field) => (
              <div key={field.name} className="md:col-span-6 lg:col-span-4">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  {field.label}
                </label>

                <input
                  name={field.name}
                  value={(formData as any)[field.name]}
                  readOnly={field.name === "Direct_Manager_Name"}
                  onChange={async (e) => {
                    let value = e.target.value;

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
                          console.log("FETCHED EMP:", emp);

                          setFormData({
                            emp_code: emp.emp_code || value,
                            emp_name: emp.emp_name || "",
                            designation: emp.designation || "",
                            department: emp.department || "",
                            functional_area: emp.functional_area || "",
                            Direct_Manager_Name: emp.Direct_Manager_Name || "",
                          });
                        }
                      }
                      return;
                    }

                    if (field.name === "emp_name") {
                      value = value.replace(/[^a-zA-Z\s]/g, "");
                    }

                    setFormData((prev: any) => ({
                      ...prev,
                      [field.name]: value,
                    }));
                  }}
                  className={`w-full rounded-xl border border-slate-200 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 ${
                    field.name === "Direct_Manager_Name" ? "bg-slate-100/90" : ""
                  }`}
                  required={field.name !== "Direct_Manager_Name"}
                />
              </div>
            ))}

            <div className="md:col-span-12 lg:col-span-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition shadow-[0_12px_26px_rgba(37,99,235,0.3)] ${
                  isSubmitting
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(37,99,235,0.38)]"
                }`}
              >
                {isSubmitting
                  ? "Saving..."
                  : editingCode
                    ? "Update Employee"
                    : "Save Employee"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-800">Employee List</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Total: {employees.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Emp Code</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Designation</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Functional Area</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Direct Manager</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {employees.length ? (
                  employees.map((emp, index) => (
                    <tr key={index} className="transition hover:bg-cyan-50/55">
                      <td className="px-4 py-3 font-semibold text-slate-700">{emp.emp_code}</td>
                      <td className="px-4 py-3 text-slate-700">{emp.emp_name}</td>
                      <td className="px-4 py-3 text-slate-700">{emp.designation}</td>
                      <td className="px-4 py-3 text-slate-700">{emp.department}</td>
                      <td className="px-4 py-3 text-slate-700">{emp.functional_area}</td>
                      <td className="px-4 py-3 text-slate-700">{emp.Direct_Manager_Name || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingCode(emp.emp_code);
                              setFormData(emp);
                            }}
                            className="rounded bg-blue-600 px-3 py-1 text-white"
                          >
                            Edit
                          </button>

                          <button
                            onClick={async () => {
                              if (!confirm("Are you sure you want to delete?")) {
                                return;
                              }

                              await fetch(
                                `/api/incharge/employees?emp_code=${emp.emp_code}`,
                                { method: "DELETE" },
                              );

                              loadEmployees();
                            }}
                            className="rounded bg-red-600 px-3 py-1 text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      No employees found.
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
