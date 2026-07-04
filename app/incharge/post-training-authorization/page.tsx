"use client";

import { useEffect, useState } from "react";

type AuthorizationItem = {
  id: number;
  source_plan_id: number | null;
  emp_code: string;
  emp_name: string;
  plan_desc: string;
  skill_area_id: number | null;
  skill_area_name: string | null;
  project_skill_names: string | null;
  year: string | null;
  responsible_person: string | null;
  target_date: string | null;
  Completion_date: string | null;
  training_location: string | null;
  target_outcome: string | null;
  actual_outcome: string | null;
  effectiveness_desired: number | null;
  effectiveness_actual: number | null;
  effectiveness_gap: number | null;
  gap_fulfilled: boolean | null;
  key_learnings: string | null;
  evidence_file: string | null;
  requested_by: string;
  requested_by_name: string | null;
  status: string;
  requested_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  checked?: boolean;
};

export default function PostTrainingAuthorizationPage() {
  const [items, setItems] = useState<AuthorizationItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/incharge/post-training-authorization", {
        cache: "no-store",
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    const pendingItems = items.filter((item) => item.status === "Pending");
    if (selectedIds.length === pendingItems.length && pendingItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingItems.map((item) => item.id));
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  };

  const reviewSelectedRequests = async (action: "approve" | "reject") => {
    if (selectedIds.length === 0) {
      alert("Please select at least one request to review.");
      return;
    }

    const res = await fetch("/api/incharge/post-training-authorization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Unable to update authorization request");
      return;
    }

    void loadItems();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const reviewRequest = async (id: number, action: "approve" | "reject") => {
    const res = await fetch("/api/incharge/post-training-authorization", {
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
      "Skill(s)",
      "Year",
      "Responsible Person",
      "Location",
      "Target Date",
      "Completion Date",
      "Target Outcome",
      "Actual Outcome",
      "Gap",
      "Gap Fulfilled",
      "Key Learnings",
      "Evidence File",
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
      item.project_skill_names ?? "",
      item.year ?? "",
      item.responsible_person ?? "",
      item.training_location ?? "",
      formatDateOnly(item.target_date),
      formatDateOnly(item.Completion_date),
      item.target_outcome ?? item.effectiveness_desired ?? "",
      item.actual_outcome ?? item.effectiveness_actual ?? "",
      item.effectiveness_gap ?? "",
      item.gap_fulfilled ? "Yes" : "No",
      item.key_learnings ?? "",
      item.evidence_file ?? "",
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
                  <x:Name>PostTrainingAuth</x:Name>
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
                Post-Training Authorization Report
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
    link.download = `post-training-authorization-${dateTag}.xls`;
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
                Post-Training Authorization
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Pending post-training entries submitted by incharge users for admin review.
              </p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Admin Review
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
              <>
                {/* Bulk Actions Bar */}
                {selectedIds.length > 0 && (
                  <div className="mb-4 flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3">
                    <span className="text-sm font-semibold text-emerald-700">
                      {selectedIds.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => reviewSelectedRequests("approve")}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Approve All
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewSelectedRequests("reject")}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Reject All
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600" style={{ width: "48px" }}>
                          <input
                            type="checkbox"
                            checked={
                              items.filter((item) => item.status === "Pending").length > 0 &&
                              selectedIds.length === items.filter((item) => item.status === "Pending").length &&
                              items.some((item) => item.status === "Pending")
                            }
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            title="Select all pending requests"
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
                          Skill(s)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Responsible
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Location
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Target Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Completion Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Target Outcome
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Actual Outcome
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Gap
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Gap Fulfilled
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Key Learnings
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
                          Evidence
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
                            colSpan={18}
                            className="px-4 py-10 text-center text-sm text-slate-500"
                          >
                            No authorization requests found.
                          </td>
                        </tr>
                      ) : (
                        items.map((item) => (
                          <tr key={item.id} className="align-top transition hover:bg-cyan-50/55">
                            <td className="px-4 py-3 text-center">
                              {item.status === "Pending" ? (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(item.id)}
                                  onChange={() => toggleSelectItem(item.id)}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                              ) : (
                                <span className="text-slate-300">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="h-5 w-5"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.5.6 3.12 0 4.5-1.803 4.5-4.5 0-.939-.233-1.783-.633-2.533a4.49 4.49 0 00-3.5-2.267c-2.573 0-4.6 1.5-5.5 1.5-.9 0-2.925-1.5-5.5-1.5A4.49 4.49 0 003.1 3.799c-.4 2.757.756 5.5 4.5 5.5H7a1 1 0 000-2h3.5a1 1 0 000-2H7a1 1 0 000-2h3.5a1 1 0 000-2H4.867c.25.322.51.637.785.942a1 1 0 001.217.153l1.5-1a1 1 0 00.153-1.217A2.49 2.49 0 017 2c-1.647 0-3 .75-3 1.5S5.353 5 7 5h3a1 1 0 011 1v1H7a1 1 0 00-1 1v3a1 1 0 001 1h4a1 1 0 001-1V9.586a2.49 2.49 0 011.757-.703c1.027 0 2.5.6 3.5.6 3.12 0 4.5-1.803 4.5-4.5 0-.939-.233-1.783-.633-2.533zM6 13a1 1 0 011-1h8a1 1 0 110 2H7a1 1 0 01-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-slate-700">{item.emp_name}</div>
                              <div className="text-xs text-slate-500">{item.emp_code}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              <div className="max-w-[220px] whitespace-normal break-words">{item.plan_desc}</div>
                              <div className="text-xs text-slate-500">{item.year || ""}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              <div className="max-w-[180px] whitespace-normal break-words">
                                {item.skill_area_name || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              <div className="max-w-[220px] whitespace-normal break-words">
                                {item.project_skill_names || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.responsible_person || "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.training_location || "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {item.target_date ? item.target_date.split("T")[0] : "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {item.Completion_date ? item.Completion_date.split("T")[0] : "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {item.target_outcome ?? item.effectiveness_desired ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {item.actual_outcome ?? item.effectiveness_actual ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.effectiveness_gap ?? "-"}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.gap_fulfilled ? "Yes" : "No"}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              <div className="max-w-xs whitespace-pre-wrap break-words">
                                {item.key_learnings || "-"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {item.evidence_file ? (
                                <a
                                  href={`/attachments/${item.evidence_file}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  View
                                </a>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-slate-700">{item.requested_by_name || item.requested_by}</div>
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
                                <span className="text-xs text-slate-400">Reviewed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
