"use client";

import { Suspense } from "react";
import Link from "next/link";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";
import { useExecutiveAnalytics } from "../useExecutiveAnalytics";

function Body() {
  const { range, setRange, analytics, loading, error, reload } =
    useExecutiveAnalytics();
  const p = analytics?.predictive;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">
          Predictive maintenance trends
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Rollup of existing predictive health snapshots, open risk alerts, and
          daily risk trend series.
        </p>
      </header>
      <ExecutiveNav range={range} onRangeChange={setRange} />
      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-200">{error}</p>
          <MatrixButton type="button" className="mt-3" onClick={() => void reload()}>
            Retry
          </MatrixButton>
        </div>
      ) : null}
      {loading && !analytics ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-800/60" />
      ) : null}
      {p ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MatrixStatCard label="Evaluated" value={String(p.machinesEvaluated)} />
            <MatrixStatCard
              label="High risk"
              value={String(p.highRisk)}
              status={p.highRisk > 0 ? "watch" : "ok"}
            />
            <MatrixStatCard
              label="Critical risk"
              value={String(p.criticalRisk)}
              status={p.criticalRisk > 0 ? "attention" : "ok"}
            />
            <MatrixStatCard
              label="Open alerts"
              value={String(p.openAlerts)}
              href="/ai-operations/predictive-maintenance/alerts"
            />
            <MatrixStatCard
              label="Due in 14 days"
              value={String(p.dueSoon14d)}
              href="/ai-operations/predictive-maintenance/forecast"
            />
          </div>
          <MatrixCard className="p-4">
            <h2 className="mb-3 text-lg font-medium text-slate-100">
              Highest risk machines
            </h2>
            {p.topRiskMachines.length === 0 ? (
              <p className="text-sm text-slate-400">
                No high/critical predictive risk machines right now.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {p.topRiskMachines.map((m) => (
                  <li
                    key={m.machineId}
                    className="rounded-lg border border-slate-800 px-3 py-2"
                  >
                    <Link
                      href={m.href}
                      className="font-medium text-cyan-300 hover:underline"
                    >
                      {m.machineId}
                    </Link>
                    <span className="ml-2 text-xs text-slate-500">
                      {m.riskLevel} · health {m.healthScore}
                    </span>
                    <p className="text-xs text-slate-400">
                      {m.reason ?? "No primary reason recorded."}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </MatrixCard>
          <MatrixCard className="p-4">
            <h2 className="mb-3 text-lg font-medium text-slate-100">
              Predictive risk trend (snapshots by day)
            </h2>
            {!p.trendSeries?.length ||
            p.trendSeries.every(
              (d) => d.evaluated === 0 && d.highRisk === 0 && d.criticalRisk === 0,
            ) ? (
              <p className="text-sm text-slate-400">
                No snapshot activity in this range yet.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-slate-400">
                {p.trendSeries
                  .filter((d) => d.evaluated > 0 || d.highRisk > 0 || d.criticalRisk > 0)
                  .slice(-21)
                  .map((d) => (
                    <li key={d.date} className="flex flex-wrap gap-3">
                      <span className="w-24 text-slate-500">{d.date}</span>
                      <span>eval {d.evaluated}</span>
                      <span className="text-amber-300">high {d.highRisk}</span>
                      <span className="text-rose-300">
                        critical {d.criticalRisk}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </MatrixCard>
        </>
      ) : null}
    </div>
  );
}

export default function ExecutivePredictivePage() {
  return (
    <MatrixShell
      title="Predictive analytics"
      activePath="/executive-command-center"
    >
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
