"use client";

import { useEffect, useState } from "react";

type AuthorizationItem = {
  id: number;
  source_mapping_id: number | null;
  emp_code: string;
  emp_name: string;
  skill_name: string;
  desired_level: number;
  actual_level: number;
  gap: number;
  requested_by: string;
  requested_by_name: string | null;
  status: string;
  requested_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
};

export default function SkillAuthorizationPage() {
  const [items, setItems] = useState<AuthorizationItem[]>([]);
  const [activeRole] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem("activeRole") ?? "",
  );
  const [loading, setLoading] = useState(true);

  const loadItems = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/incharge/skills-authorization", {
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
    const res = await fetch("/api/incharge/skills-authorization", {
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

    const formatDateTime = (value: string | null) =>
      value ? new Date(value).toLocaleString() : "";

    const headers = [
      "Employee Code",
      "Employee Name",
      "Skill",
      "Desired Level",
      "Actual Level",
      "Gap",
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
      item.skill_name,
      item.desired_level,
      item.actual_level,
      item.gap,
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
                  <x:Name>SkillAuth</x:Name>
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
                Skill Authorization Report
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
    link.download = `skills-authorization-${dateTag}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (activeRole && activeRole !== "Admin") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        This page is only available for the Admin role.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-slate-200 py-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-semibold text-slate-800">
            Skill Authorization
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pending skill mappings submitted by incharge users will appear here
            for admin review.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-end">
            <button
              type="button"
              onClick={downloadExcel}
              disabled={items.length === 0}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                items.length === 0
                  ? "cursor-not-allowed bg-slate-400"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              Download Excel
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading requests...</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Skill</th>
                  <th className="p-4">Desired</th>
                  <th className="p-4">Actual</th>
                  <th className="p-4">Gap</th>
                  <th className="p-4">Requested By</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      No authorization requests found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-medium text-slate-700">
                          {item.emp_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.emp_code}
                        </div>
                      </td>
                      <td className="p-4">{item.skill_name}</td>
                      <td className="p-4">{item.desired_level}</td>
                      <td className="p-4">{item.actual_level}</td>
                      <td className="p-4">{item.gap}</td>
                      <td className="p-4">
                        <div>{item.requested_by_name || item.requested_by}</div>
                        <div className="text-xs text-slate-500">
                          {new Date(item.requested_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4">
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
                      <td className="p-4 text-center">
                        {item.status === "Pending" ? (
                          <div className="space-x-2">
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
          )}
        </div>
      </div>
    </div>
  );
}
