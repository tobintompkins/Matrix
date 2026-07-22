"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";
import type { PeriodReportBundle } from "@/lib/executive-command-center/reporting-types";

function Body() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const period = searchParams.get("period") || "WEEKLY";
  const [report, setReport] = useState<PeriodReportBundle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/executive-command-center/reporting?period=${encodeURIComponent(period)}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setReport(json.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">KPI Scorecards</h1>
        <p className="mt-1 text-sm text-slate-400">
          Server-aggregated scorecards with previous-period deltas, definitions,
          and drill-downs. Unavailable when source data is missing.
        </p>
      </header>
      <ExecutiveNav
        range={range}
        onRangeChange={(next) => {
          const p = new URLSearchParams(searchParams.toString());
          p.set("range", next);
          router.push(`?${p.toString()}`);
        }}
      />
      <label className="flex items-center gap-2 text-sm text-slate-400">
        Period
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-200"
          value={period}
          onChange={(e) => {
            const p = new URLSearchParams(searchParams.toString());
            p.set("period", e.target.value);
            router.push(`?${p.toString()}`);
          }}
        >
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="ANNUAL">Annual</option>
        </select>
      </label>
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-200">{error}</p>
          <MatrixButton type="button" className="mt-3" onClick={() => void load()}>
            Retry
          </MatrixButton>
        </div>
      ) : null}
      {loading && !report ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-800/60" />
      ) : null}
      {report ? (
        <div className="grid gap-3 md:grid-cols-2">
          {report.scorecards.map((s) => (
            <MatrixCard key={s.key} className="p-4">
              <h2 className="text-lg font-medium text-slate-100">
                {s.href ? (
                  <Link href={s.href} className="hover:text-cyan-300">
                    {s.label}
                  </Link>
                ) : (
                  s.label
                )}
              </h2>
              <p className="mt-2 text-3xl text-cyan-200">
                {s.available ? String(s.value) : "—"}
                {s.available && s.unit === "percent" ? "%" : ""}
                {s.available && s.unit === "hours" ? "h" : ""}
              </p>
              <p className="mt-1 text-xs uppercase text-slate-500">{s.status}</p>
              {s.previousValue != null && s.absoluteChange != null ? (
                <p className="mt-1 text-xs text-slate-400">
                  Prev {s.previousValue}
                  {s.unit === "percent" ? "%" : ""} · Δ {s.absoluteChange}
                  {s.percentChange != null ? ` (${s.percentChange}%)` : ""} ·{" "}
                  {s.trend}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-600">
                  Prior-period delta unavailable
                </p>
              )}
              <p className="mt-2 text-sm text-slate-400">{s.detail}</p>
              {s.definition ? (
                <p className="mt-2 text-xs text-slate-500">{s.definition}</p>
              ) : null}
              {s.updatedAt ? (
                <p className="mt-1 text-[10px] text-slate-600">
                  Updated {new Date(s.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </MatrixCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ExecutiveScorecardsPage() {
  return (
    <MatrixShell title="KPI Scorecards" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_REPORTS"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
