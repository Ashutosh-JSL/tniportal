"use client";

import { useCallback, useEffect, useState } from "react";

type AuthorizationItem = {
  id: number;
  source_plan_id: number | null;
  emp_code: string;
  emp_name: string;
  plan_desc: string;
  skill_area_id: number | null;
  skill_area_name: string | null;
  plan_type: string | null;
  project_skill_names: string | null;
  year: string | null;
  responsible_person: string | null;
  target_date: string | null;
  training_location: string | null;
  requested_by: string;
  requested_by_name: string | null;
  status: string;
  requested_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
};

export default function TrainingPlanAuthorizationPage() {
  const [items, setItems] = useState<AuthorizationItem[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );
  const [loading, setLoading] = useState(true);

  const isAdmin = activeRole.trim().toLowerCase() === "admin";

  const loadItems = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);

    try {
      const res = await fetch("/api/incharge/training-plan-authorization", {
        cache: "no-store",
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isAdmin) {
        void loadItems();
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isAdmin, loadItems]);

  const bulkReviewRequest = async (action: "approve" | "reject") => {
    if (checkedIds.length === 0) {
      alert(`Please select at least one record to ${action}.`);
      return;
    }

    try {
      const res = await fetch("/api/incharge/training-plan-authorization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: checkedIds }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? `Unable to ${action} training plan(s)`);
        return;
      }

      setCheckedIds([]);
      void loadItems();
    } catch (error) {
      console.error("Bulk review error:", error);
      alert(`Failed to ${action} training plan(s).`);
    }
  };

  const toggleCheck = (id: number) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    // Only select pending items
    const pendingItems = items.filter((item) => item.status === "Pending");

    if (checkedIds.length === pendingItems.length && pendingItems.length > 0) {
      setCheckedIds([]);
    } else {
      setCheckedIds(pendingItems.map((item) => item.id));
    }
  };

  const reviewRequest = async (id: number, action: "approve" | "reject") => {
    const res = await fetch("/api/incharge/training-plan-authorization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? `Unable to ${action} training plan`);
      return;
    }

    void loadItems();
  };

  const downloadExcel = () => {
    if (items.length === 0) {
      alert("No data available to download");
      return;
    }

    const escapeHtml = (value: unknown) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const formatDateOnly = (value: string | null) =>
      value ? value.split("T")[0] : "";

    const formatDateTime = (value: string | null) =>
      value ? new Date(value).toLocaleString() : "";

    const headers = [
      "Employee Code",
      "Employee Name",
      "Plan",
      "Skill Area",
      "Plan Type",
      "Skill(s)",
      "Responsible Person",
      "Target Date",
      "Location",
      "Year",
      "Requested By Code",
      "Requested By Name",
      "Requested At",
      "Status",
      "Reviewed By Name",
      "Reviewed At",
    ];

    const rows = items.map((item, index) => [
      item.emp_code,
      item.emp_name,
      item.plan_desc,
      item.skill_area_name ?? "",
      item.plan_type ?? "Training",
      item.project_skill_names ?? "",
      item.responsible_person ?? "",
      formatDateOnly(item.target_date),
      item.training_location ?? "",
      item.year ?? "",
      item.requested_by,
      item.requested_by_name ?? "",
      formatDateTime(item.requested_at),
      item.status,
      item.reviewed_by_name ?? "",
      formatDateTime(item.reviewed_at),
      index % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
    ]);

    const tableHeader = headers
      .map(
        (header) =>
          `<th style="background:#1E3A8A;color:#FFFFFF;font-weight:700;border:1px solid #CBD5E1;padding:8px;text-align:left;white-space:nowrap;">${escapeHtml(header)}</th>`,
      )
      .join("");

    const tableRows = rows
      .map((row) => {
        const rowColor = row[row.length - 1] as string;
        const cells = row
          .slice(0, -1)
          .map(
            (cell) =>
              `<td style="border:1px solid #CBD5E1;padding:7px;background:${rowColor};vertical-align:top;">${escapeHtml(cell)}</td>`,
          )
          .join("");

        return `<tr>${cells}</tr>`;
      })
      .join("");

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>TrainingPlanAuth</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
        </head>
        <body>
          <table style="border-collapse:collapse;font-family:Calibri,Segoe UI,Arial,sans-serif;font-size:11pt;">
            <tr>
              <td colspan="${headers.length}"
                  style="font-size:14pt;font-weight:700;padding:10px 8px;color:#0F172A;">
                Training Plan Authorization Report
              </td>
            </tr>
            <tr>
              <td colspan="${headers.length}"
                  style="padding:0 8px 10px 8px;color:#475569;">
                Generated: ${escapeHtml(new Date().toLocaleString())}
              </td>
            </tr>
            <tr>${tableHeader}</tr>
            ${tableRows}
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelHtml], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateTag = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `training-plan-authorization-${dateTag}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusClass = (status: string) =>
    status === "Pending"
      ? "bg-amber-100 text-amber-800"
      : status === "Approved"
        ? "bg-green-100 text-green-700"
        : status === "Rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700";

  const getPlanTypeClass = (type: string | null) =>
    type === "Project"
      ? "bg-indigo-100 text-indigo-700"
      : "bg-cyan-100 text-cyan-700";

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-[0_18px_40px_rgba(15,23,42,0.08)] sm:p-8">
            This page is only available for the Admin role.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0f2fe,_#f8fafc_45%,_#eef2ff)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                Training Plan Authorization
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Approve or reject training plans submitted by incharge users.
              </p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Admin Review
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/75 bg-white/75 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-800">
              Training Plan Approvals
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {checkedIds.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => bulkReviewRequest("approve")}
                    className="rounded-xl px-4 py-2 text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition"
                  >
                    Approve Selected ({checkedIds.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkReviewRequest("reject")}
                    className="rounded-xl px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                  >
                    Reject Selected ({checkedIds.length})
                  </button>
                </>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Total: {items.length}
              </span>
              <button
                type="button"
                onClick={downloadExcel}
                disabled={items.length === 0}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                  items.length === 0
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                Download Excel
              </button>
            </div>
          </div>

          {loading ? (
            <p className="px-1 py-3 text-sm text-slate-500">Loading requests...</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && checkedIds.length === items.length}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Skill Area
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Skill(s)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Responsible
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Target Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Year
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No training plan approvals found.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="transition hover:bg-cyan-50/55">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checkedIds.includes(item.id)}
                            onChange={() => toggleCheck(item.id)}
                            disabled={item.status !== "Pending"}
                            className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-slate-700">
                            {item.emp_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {item.emp_code}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {item.plan_desc}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {item.skill_area_name || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPlanTypeClass(
                              item.plan_type,
                            )}`}
                          >
                            {item.plan_type ?? "Training"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {item.project_skill_names || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {item.responsible_person}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {item.target_date ? item.target_date.split("T")[0] : ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {item.training_location}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {item.year}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                              item.status,
                            )}`}
                          >
                            {item.status}
                          </span>
                          {item.reviewed_by_name && item.status !== "Pending" ? (
                            <div className="mt-2 text-xs text-slate-500">
                              {item.reviewed_by_name}
                              {item.reviewed_at
                                ? ` | ${new Date(item.reviewed_at).toLocaleString()}`
                                : ""}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.status === "Pending" ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => reviewRequest(item.id, "approve")}
                                className="rounded bg-green-600 px-3 py-1 text-white"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => reviewRequest(item.id, "reject")}
                                className="rounded bg-red-600 px-3 py-1 text-white"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Reviewed by {item.reviewed_by_name || "Admin"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
