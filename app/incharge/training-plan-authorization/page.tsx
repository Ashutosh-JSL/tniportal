"use client";

import { useEffect, useState } from "react";

type AuthorizationItem = {
  id: number;
  source_plan_id: number | null;
  emp_code: string;
  emp_name: string;
  plan_desc: string;
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
            Training Plan Authorization
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Pending training plans submitted by incharge users will appear here
            for admin review.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg">
          {loading ? (
            <p className="text-sm text-slate-500">Loading requests...</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Responsible</th>
                  <th className="p-4">Target Date</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Year</th>
                  <th className="p-4">Requested By</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
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
                      <td className="p-4">{item.plan_desc}</td>
                      <td className="p-4">{item.responsible_person}</td>
                      <td className="p-4">
                        {item.target_date ? item.target_date.split("T")[0] : ""}
                      </td>
                      <td className="p-4">{item.training_location}</td>
                      <td className="p-4">{item.year}</td>
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
                              ? ` • ${new Date(item.reviewed_at).toLocaleString()}`
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
