"use client";

import { Suspense } from "react";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";
import TrendBars from "../TrendBars";
import { useExecutiveAnalytics } from "../useExecutiveAnalytics";

function Body() {
  const { range, setRange, analytics, loading, error, reload } =
    useExecutiveAnalytics();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">KPI Trends</h1>
        <p className="mt-1 text-sm text-slate-400">
          Day-by-day operational and AI signal trends for the selected range.
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
      {analytics ? (
        analytics.kpiTrends.seriesEmpty ? (
          <MatrixCard className="p-6">
            <p className="text-sm text-slate-400">
              No trend points with activity in {analytics.rangeLabel}.
            </p>
          </MatrixCard>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <MatrixCard className="p-4">
              <TrendBars
                title="Critical / emergency call volume"
                data={analytics.kpiTrends.series.map((p) => ({
                  label: p.date.slice(5),
                  value: p.criticalCalls,
                }))}
              />
            </MatrixCard>
            <MatrixCard className="p-4">
              <TrendBars
                title="Closed / resolved calls"
                data={analytics.kpiTrends.series.map((p) => ({
                  label: p.date.slice(5),
                  value: p.closedCalls,
                }))}
              />
            </MatrixCard>
            <MatrixCard className="p-4">
              <TrendBars
                title="AI insights created"
                data={analytics.kpiTrends.series.map((p) => ({
                  label: p.date.slice(5),
                  value: p.insightsCreated,
                }))}
              />
            </MatrixCard>
            <MatrixCard className="p-4">
              <TrendBars
                title="High/critical AI insights"
                data={analytics.kpiTrends.series.map((p) => ({
                  label: p.date.slice(5),
                  value: p.insightsCritical,
                }))}
              />
            </MatrixCard>
          </div>
        )
      ) : null}
    </div>
  );
}

export default function ExecutiveTrendsPage() {
  return (
    <MatrixShell title="KPI Trends" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
