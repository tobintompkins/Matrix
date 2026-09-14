"use client";

import { Suspense } from "react";
import Link from "next/link";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard, MatrixStatCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";
import TrendBars from "../TrendBars";
import { useExecutiveAnalytics } from "../useExecutiveAnalytics";

function AnalyticsBody() {
  const { range, setRange, analytics, loading, error, reload } =
    useExecutiveAnalytics();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">
          Executive KPI dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Executive Intelligence KPIs across service, fleet, parts, technicians,
          customers, predictive risk, and AI — from live Matrix records.
        </p>
      </header>

      <ExecutiveNav range={range} onRangeChange={setRange} />

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4" role="alert">
          <p className="text-sm text-rose-200">{error}</p>
          <MatrixButton type="button" className="mt-3" onClick={() => void reload()}>
            Retry
          </MatrixButton>
        </div>
      ) : null}

      {loading && !analytics ? (
        <div className="animate-pulse space-y-3" aria-busy="true">
          <div className="h-24 rounded-xl bg-slate-800/60" />
          <div className="h-40 rounded-xl bg-slate-800/60" />
        </div>
      ) : null}

      {analytics?.empty ? (
        <MatrixCard className="p-6">
          <h2 className="text-lg text-slate-100">No analytics yet</h2>
          <p className="mt-2 text-sm text-slate-400">{analytics.emptyMessage}</p>
        </MatrixCard>
      ) : null}

      {analytics && !analytics.empty ? (
        <>
          <p className="text-xs text-slate-500">
            {analytics.rangeLabel} · refreshed{" "}
            {new Date(analytics.generatedAt).toLocaleString()} ·{" "}
            {analytics.dataCompleteness}% data completeness
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MatrixStatCard
              label="Open service calls"
              value={String(analytics.kpiTrends.current.openServiceCalls)}
              status={
                analytics.kpiTrends.current.criticalServiceCalls > 0
                  ? "attention"
                  : "neutral"
              }
              href="/service-calls"
            />
            <MatrixStatCard
              label="Machines at risk"
              value={String(analytics.kpiTrends.current.machinesAtRisk)}
              status={
                analytics.kpiTrends.current.machinesAtRisk > 0 ? "watch" : "ok"
              }
              href="/executive-command-center/predictive"
            />
            <MatrixStatCard
              label="PM overdue"
              value={String(analytics.kpiTrends.current.pmOverdue)}
              href="/maintenance"
            />
            <MatrixStatCard
              label="Fleet health"
              value={
                analytics.kpiTrends.current.fleetHealthScore == null
                  ? "—"
                  : String(analytics.kpiTrends.current.fleetHealthScore)
              }
              href="/executive-command-center"
            />
            <MatrixStatCard
              label="Organization health"
              value={
                analytics.kpiTrends.current.organizationHealthScore == null
                  ? "—"
                  : String(analytics.kpiTrends.current.organizationHealthScore)
              }
              href="/admin/organization-health"
            />
            <MatrixStatCard
              label="Parts consumed"
              value={String(analytics.partsConsumption.totalConsumed)}
              href="/inventory"
              status={analytics.partsConsumption.empty ? "unavailable" : "neutral"}
            />
          </div>

          {!analytics.partsConsumption.empty ? (
            <MatrixCard className="p-4">
              <h2 className="mb-3 text-lg font-medium text-slate-100">
                Parts consumption (top)
              </h2>
              <ul className="space-y-2 text-sm">
                {analytics.partsConsumption.topParts.slice(0, 8).map((p) => (
                  <li
                    key={p.partNumber}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 py-1"
                  >
                    <Link href={p.href} className="text-cyan-300 hover:underline">
                      {p.partNumber}
                    </Link>
                    <span className="text-slate-400">
                      {p.quantityConsumed} units · {p.issueEvents} issues
                    </span>
                  </li>
                ))}
              </ul>
            </MatrixCard>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <MatrixCard className="p-4">
              <TrendBars
                title="Service calls created (by day)"
                data={analytics.kpiTrends.series.map((p) => ({
                  label: p.date.slice(5),
                  value: p.openCalls + p.closedCalls + p.criticalCalls,
                }))}
              />
            </MatrixCard>
            <MatrixCard className="p-4">
              <TrendBars
                title="AI insights created (by day)"
                data={analytics.kpiTrends.series.map((p) => ({
                  label: p.date.slice(5),
                  value: p.insightsCreated,
                }))}
              />
            </MatrixCard>
          </div>

          <MatrixCard className="p-4">
            <h2 className="mb-3 text-lg font-medium text-slate-100">
              Drill-down navigation
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {analytics.drilldowns.map((d) => (
                <li key={d.key}>
                  <Link
                    href={`${d.href}?range=${encodeURIComponent(range)}`}
                    className="block rounded-lg border border-slate-800 px-3 py-2 text-sm text-cyan-300 hover:border-cyan-500/40"
                  >
                    {d.label}
                    <span className="mt-1 block text-xs text-slate-500">
                      {d.count} items
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </MatrixCard>
        </>
      ) : null}
    </div>
  );
}

export default function ExecutiveAnalyticsPage() {
  return (
    <MatrixShell title="Executive Analytics" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <AnalyticsBody />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
