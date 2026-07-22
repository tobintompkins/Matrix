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
import TrendBars from "../TrendBars";
import { useExecutiveAnalytics } from "../useExecutiveAnalytics";

function Body() {
  const { range, setRange, analytics, loading, error, reload } =
    useExecutiveAnalytics();
  const ai = analytics?.aiInsights;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">AI insights</h1>
        <p className="mt-1 text-sm text-slate-400">
          Advisory insights from AI Operations for the selected range. Review
          before acting.
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
      {ai ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MatrixStatCard label="Active" value={String(ai.active)} href="/ai-operations" />
            <MatrixStatCard
              label="High / critical"
              value={String(ai.critical)}
              status={ai.critical > 0 ? "attention" : "ok"}
            />
            <MatrixStatCard
              label="Pending review"
              value={String(ai.pendingReview)}
              status={ai.pendingReview > 0 ? "watch" : "neutral"}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <MatrixCard className="p-4">
              <TrendBars
                title="Insights created (AI ops trend)"
                data={(ai.series ?? []).map((s) => ({
                  label: s.date.slice(5),
                  value: s.created,
                }))}
                emptyMessage={
                  ai.trendEmpty
                    ? "No AI insight trend data in this range."
                    : "No series points."
                }
              />
            </MatrixCard>
            <MatrixCard className="p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-200">
                Top open insights
              </h2>
              {ai.topInsights.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No active insights in this range.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {ai.topInsights.map((i) => (
                    <li key={i.id} className="rounded-lg border border-slate-800 px-3 py-2">
                      <Link href={i.href} className="text-cyan-300 hover:underline">
                        {i.title}
                      </Link>
                      <div className="text-xs text-slate-500">
                        {i.severity} · {i.status}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </MatrixCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function ExecutiveInsightsPage() {
  return (
    <MatrixShell title="AI insights" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
