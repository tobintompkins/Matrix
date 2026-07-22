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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            Executive reports
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Range analytics report sections. For period packs, AI summaries, and
            PDF/Excel exports, use the{" "}
            <Link
              href="/executive-command-center/report-center"
              className="text-cyan-300 hover:underline"
            >
              Report Center
            </Link>
            .
          </p>
        </div>
        <a
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-cyan-300 hover:border-cyan-500/40"
          href={`/api/executive-command-center/reports?range=${encodeURIComponent(range)}&format=csv`}
        >
          Download CSV
        </a>
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
        <div className="grid gap-3 md:grid-cols-2">
          {analytics.reports.map((section) => (
            <MatrixCard key={section.key} className="space-y-2 p-4">
              <h2 className="text-lg font-medium text-slate-100">
                {section.title}
              </h2>
              <p className="text-sm text-slate-400">{section.summary}</p>
              <ul className="text-sm text-slate-300">
                {section.metrics.map((m) => (
                  <li key={m.label}>
                    {m.label}: {m.value}
                  </li>
                ))}
              </ul>
              <Link
                href={section.href}
                className="inline-block text-xs text-cyan-300 hover:underline"
              >
                Open source module →
              </Link>
            </MatrixCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ExecutiveReportsPage() {
  return (
    <MatrixShell title="Executive reports" activePath="/executive-command-center">
      <MatrixAuthGuard requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}>
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
