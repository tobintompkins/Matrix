"use client";

import { Suspense } from "react";
import Link from "next/link";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";
import { useExecutiveAnalytics } from "../useExecutiveAnalytics";

function Body() {
  const { range, setRange, analytics, loading, error, reload } =
    useExecutiveAnalytics();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">
          Technician productivity
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Closed-in-range completions, completion rate, and workload vs assumed
          capacity from the dispatch roster and service calls.
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
        analytics.technicians.length === 0 ? (
          <MatrixCard className="p-6">
            <p className="text-sm text-slate-400">
              No technician roster is loaded.
            </p>
          </MatrixCard>
        ) : (
          <MatrixCard className="overflow-x-auto p-4">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-2">Technician</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Open</th>
                  <th className="px-2 py-2">Critical</th>
                  <th className="px-2 py-2">Closed in range</th>
                  <th className="px-2 py-2">Completion %</th>
                  <th className="px-2 py-2">Workload / capacity</th>
                  <th className="px-2 py-2">Territory</th>
                </tr>
              </thead>
              <tbody>
                {analytics.technicians.map((t) => (
                  <tr key={t.name} className="border-t border-slate-800 text-slate-200">
                    <td className="px-2 py-2">
                      <Link href={t.href} className="text-cyan-300 hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{t.status}</td>
                    <td className="px-2 py-2">{t.openCalls}</td>
                    <td className="px-2 py-2">{t.criticalCalls}</td>
                    <td className="px-2 py-2">{t.closedInRange}</td>
                    <td className="px-2 py-2">
                      {t.completionRate == null ? "—" : `${t.completionRate}%`}
                    </td>
                    <td className="px-2 py-2 text-slate-400">
                      {t.workloadHours}h / {t.capacityHours}h
                      {t.workloadVsCapacityPct != null
                        ? ` (${t.workloadVsCapacityPct}%)`
                        : ""}
                    </td>
                    <td className="px-2 py-2 text-slate-400">{t.territory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MatrixCard>
        )
      ) : null}
    </div>
  );
}

export default function ExecutiveTechniciansPage() {
  return (
    <MatrixShell title="Technician productivity" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
