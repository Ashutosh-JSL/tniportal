"use client";

import { useEffect, useMemo, useState } from "react";

type StatItem = {
  title: string;
  value: number;
};

type HomeData = {
  user: {
    name: string;
    role: string;
    employeeCode: string;
  };
  stats: StatItem[];
};

const CHART_COLORS = ["#06b6d4", "#2563eb", "#0ea5e9", "#0284c7", "#1d4ed8"];

export default function HomeClient() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadDashboard = async () => {
      try {
        const res = await fetch("/api/Home", { cache: "no-store" });
        const payload = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            (payload &&
              typeof payload === "object" &&
              "error" in payload &&
              typeof payload.error === "string" &&
              payload.error) ||
              "Failed to load dashboard",
          );
        }

        const normalizedStats = Array.isArray(payload?.stats)
          ? payload.stats.map((item: Partial<StatItem>) => {
              const parsedValue = Number(item?.value ?? 0);
              return {
                title: String(item?.title ?? "Metric"),
                value: Number.isFinite(parsedValue) ? parsedValue : 0,
              };
            })
          : [];

        if (!isActive) return;

        setData({
          user: {
            name: String(payload?.user?.name ?? "User"),
            role: String(payload?.user?.role ?? ""),
            employeeCode: String(payload?.user?.employeeCode ?? ""),
          },
          stats: normalizedStats,
        });
        setError(null);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      }
    };

    loadDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  const totalValue = useMemo(
    () => (data ? data.stats.reduce((sum, item) => sum + item.value, 0) : 0),
    [data],
  );

  const maxValue = useMemo(
    () => (data ? Math.max(...data.stats.map((item) => item.value), 1) : 1),
    [data],
  );

  const donutSegments = useMemo(() => {
    if (!data?.stats.length || totalValue === 0) return [];

    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    let cumulative = 0;

    return data.stats.map((item, index) => {
      const share = item.value / totalValue;
      const segment = circumference * share;
      const result = {
        ...item,
        color: CHART_COLORS[index % CHART_COLORS.length],
        dashArray: `${segment} ${circumference - segment}`,
        dashOffset: -cumulative,
        percent: share * 100,
      };

      cumulative += segment;
      return result;
    });
  }, [data, totalValue]);

  if (!data && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#cffafe,_#eef2ff_52%,_#f8fafc)] [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
        <div className="rounded-2xl border border-white/80 bg-white/70 px-6 py-4 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur">
          Loading Dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#cffafe,_#eef2ff_52%,_#f8fafc)] p-6 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
        <div className="w-full max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700 shadow-lg">
          <h2 className="text-lg font-bold">Dashboard load failed</h2>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const dashboard: HomeData = data ?? {
    user: {
      name: "User",
      role: "",
      employeeCode: "",
    },
    stats: [],
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#cffafe,_#eef2ff_52%,_#f8fafc)] px-4 py-8 sm:px-6 lg:px-8 [font-family:'Manrope',ui-sans-serif,system-ui,sans-serif]">
      <main className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/75 bg-white/70 p-6 shadow-[0_20px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-800">Welcome, {dashboard.user.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Live overview of role and training activity for your dashboard.
              </p>
            </div>
            <div className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
              {dashboard.user.role || "Dashboard"}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboard.stats.map((item, i) => (
            <div key={item.title + i} className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-[0_14px_30px_rgba(15,23,42,0.1)] backdrop-blur">
              <div
                className="h-1.5"
                style={{
                  background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, #1d4ed8)`,
                }}
              />
              <div className="p-5">
                <p className="text-sm font-semibold text-slate-500">{item.title}</p>
                <p className="mt-2 text-3xl font-bold text-slate-800">{item.value}</p>
              </div>
            </div>
          ))}
          <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-[0_14px_30px_rgba(15,23,42,0.1)] backdrop-blur">
            <div className="h-1.5 bg-gradient-to-r from-cyan-500 to-blue-700" />
            <div className="p-5">
              <p className="text-sm font-semibold text-slate-500">Total</p>
              <p className="mt-2 text-3xl font-bold text-slate-800">{totalValue}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/75 bg-white/80 p-5 shadow-[0_16px_38px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6">
            <h3 className="text-lg font-bold text-slate-800">Performance Bars</h3>
            <p className="mt-1 text-sm text-slate-500">Visual comparison of your top dashboard metrics.</p>

            <div className="relative mt-6 h-72 rounded-2xl bg-gradient-to-b from-slate-50 to-white p-4">
              <div className="pointer-events-none absolute inset-4 grid grid-rows-4">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="border-t border-slate-200/70" />
                ))}
              </div>
              <div className="relative z-10 flex h-full items-end gap-4">
                {dashboard.stats.map((item, index) => {
                  const heightPercent = Math.max((item.value / maxValue) * 100, 10);
                  return (
                    <div key={item.title + index} className="flex flex-1 flex-col items-center gap-3">
                      <div className="text-sm font-bold text-slate-700">{item.value}</div>
                      <div className="flex h-full w-full items-end">
                        <div
                          className="w-full rounded-t-2xl shadow-[0_10px_25px_rgba(14,116,144,0.2)] transition-all duration-700"
                          style={{
                            height: `${heightPercent}%`,
                            background: `linear-gradient(180deg, ${CHART_COLORS[index % CHART_COLORS.length]} 0%, #1d4ed8 100%)`,
                          }}
                        />
                      </div>
                      <div className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{item.title}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/75 bg-white/80 p-5 shadow-[0_16px_38px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6">
            <h3 className="text-lg font-bold text-slate-800">Distribution Ring</h3>
            <p className="mt-1 text-sm text-slate-500">Share of each metric in your total dashboard volume.</p>

            <div className="mt-6 grid grid-cols-1 items-center gap-6 sm:grid-cols-[240px_1fr]">
              <div className="mx-auto h-[220px] w-[220px]">
                <svg viewBox="0 0 220 220" className="h-full w-full">
                  <circle cx="110" cy="110" r="72" fill="none" stroke="#e2e8f0" strokeWidth="18" />
                  {donutSegments.map((segment, index) => (
                    <circle
                      key={segment.title + index}
                      cx="110"
                      cy="110"
                      r="72"
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="18"
                      strokeLinecap="round"
                      strokeDasharray={segment.dashArray}
                      strokeDashoffset={segment.dashOffset}
                      transform="rotate(-90 110 110)"
                    />
                  ))}
                </svg>
                <div className="-mt-[132px] text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
                  <p className="text-3xl font-bold text-slate-800">{totalValue}</p>
                </div>
              </div>

              <div className="space-y-3">
                {donutSegments.map((segment, index) => (
                  <div key={segment.title + index} className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      <span className="text-sm font-semibold text-slate-700">{segment.title}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-600">
                      {segment.value} <span className="text-slate-400">({segment.percent.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
