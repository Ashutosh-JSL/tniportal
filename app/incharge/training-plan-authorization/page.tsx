"use client";

import { useEffect, useState } from "react";

type AuthorizationItem = {
  id: number;
  source_plan_id: number | null;
  emp_code: string;
  emp_name: string;
  plan_desc: string;
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
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
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
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const reviewRequest = async (id: number, action: "approve" | "reject") => {
    const res = await fetch("/api/incharge/training-plan-authorization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Unable to update authorization request");
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
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const formatDateOnly = (value: string | null) =>
      value ? value.split("T")[0] : "";

    const formatDateTime = (value: string | null) =>
      value ? new Date(value).toLocaleString() : "";

    const headers = [
      "Employee Code",
      "Employee Name",
      "Plan",
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

  if (activeRole && activeRole !== "Admin") {
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
                Pending training plans submitted by incharge users for admin
                review.
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
              Authorization Requests
            </h2>
            <div className="flex items-center gap-2">
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
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                      Plan
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
                      Requested By
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
                        colSpan={11}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        No authorization requests found.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="transition hover:bg-cyan-50/55">
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
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              (item.plan_type ?? "Training") === "Project"
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-cyan-100 text-cyan-700"
                            }`}
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
                          <div className="text-sm text-slate-700">
                            {item.requested_by_name || item.requested_by}
                          </div>
                          <div className="text-xs text-slate-500">
                            {new Date(item.requested_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.status === "Pending"
                                ? "bg-amber-100 text-amber-800"
                                : item.status === "Approved"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {item.status}
                          </span>
                          {item.reviewed_by_name ? (
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
                              Review completed
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
