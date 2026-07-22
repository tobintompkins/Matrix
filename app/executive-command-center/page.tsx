"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MatrixShell from "../components/MatrixShell";
import MatrixAuthGuard from "../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "../components/ui";
import type { ExecutiveCommandCenterSummary } from "@/lib/executive-command-center";
import ExecutiveNav from "./ExecutiveNav";

function dataStatusLabel(status: string) {
  if (status === "live") return "Data looks current";
  if (status === "partial") return "Partial data";
  return "Limited data";
}

function severityClass(severity: string) {
  if (severity === "CRITICAL")
    return "border-rose-500/40 bg-rose-500/10 text-rose-200";
  if (severity === "HIGH")
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-slate-600 bg-slate-900/60 text-slate-300";
}

function panelStatusDot(status: string) {
  if (status === "attention") return "bg-rose-500";
  if (status === "watch") return "bg-amber-500";
  if (status === "ok") return "bg-emerald-500";
  return "bg-slate-500";
}

function ExecutiveDashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-20 rounded-xl bg-slate-800/60" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-800/60" />
        ))}
      </div>
      <div className="h-40 rounded-xl bg-slate-800/60" />
    </div>
  );
}

function ExecutiveCommandCenterBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const [summary, setSummary] = useState<ExecutiveCommandCenterSummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showFactors, setShowFactors] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/executive-command-center/summary", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Unable to load executive summary.");
      }
      setSummary(json.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function setRange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`?${params.toString()}`);
  }

  async function refreshBriefing() {
    setMessage("");
    setError("");
    const res = await fetch(
      "/api/executive-command-center/briefing/refresh",
      { method: "POST" },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Briefing refresh failed.");
      return;
    }
    setSummary((prev) =>
      prev
        ? {
            ...prev,
            aiBriefing: json.briefing,
            generatedAt: json.generatedAt ?? prev.generatedAt,
          }
        : prev,
    );
    setMessage("Executive briefing refreshed.");
  }

  const kpis = summary?.kpis;
  const fleet = summary?.fleetHealth;

  return (
        <div className="mx-auto max-w-7xl space-y-6 px-1 py-2 sm:px-2">
          <header className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-slate-100">
                  Executive Command Center
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Enterprise visibility, AI insights, and operational
                  priorities.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"
                  title="How complete the underlying Matrix data looks for this view"
                >
                  {summary
                    ? `${dataStatusLabel(summary.dataStatus)} · ${summary.dataCompleteness}% complete`
                    : "Checking data…"}
                </span>
                <Link
                  href={`/executive-command-center/analytics?range=${encodeURIComponent(range)}`}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-cyan-300 hover:border-cyan-500/40"
                >
                  Open analytics
                </Link>
                <MatrixButton type="button" onClick={() => void load()}>
                  Refresh
                </MatrixButton>
              </div>
            </div>
            {summary ? (
              <p className="text-xs text-slate-500">
                Last refreshed{" "}
                {new Date(summary.generatedAt).toLocaleString()}
              </p>
            ) : null}
          </header>

          <ExecutiveNav range={range} onRangeChange={setRange} />

          {error ? (
            <div
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4"
              role="alert"
            >
              <p className="text-sm text-rose-200">{error}</p>
              <MatrixButton
                type="button"
                className="mt-3"
                onClick={() => void load()}
              >
                Retry
              </MatrixButton>
            </div>
          ) : null}
          {message ? (
            <p className="text-sm text-emerald-300" role="status">
              {message}
            </p>
          ) : null}

          {loading && !summary ? <ExecutiveDashboardSkeleton /> : null}

          {!loading && summary?.empty ? (
            <MatrixCard className="p-6">
              <h2 className="text-lg font-medium text-slate-100">
                Waiting for operational data
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {summary.emptyMessage}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Link href="/fleet" className="text-cyan-300 hover:underline">
                  Fleet
                </Link>
                <Link
                  href="/service-calls"
                  className="text-cyan-300 hover:underline"
                >
                  Service Calls
                </Link>
                <Link
                  href="/maintenance"
                  className="text-cyan-300 hover:underline"
                >
                  Maintenance
                </Link>
              </div>
            </MatrixCard>
          ) : null}

          {summary && !summary.empty ? (
            <>
              <section aria-labelledby="ecc-kpis">
                <h2 id="ecc-kpis" className="sr-only">
                  Key performance indicators
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <MatrixStatCard
                    label="Fleet Health"
                    value={
                      fleet?.score == null ? "—" : String(fleet.score)
                    }
                    status={
                      fleet?.status === "critical"
                        ? "attention"
                        : fleet?.status === "watch"
                          ? "watch"
                          : fleet?.status === "unknown"
                            ? "unavailable"
                            : "ok"
                    }
                    trend={
                      fleet
                        ? `${fleet.status} · ${fleet.confidence}% confidence`
                        : undefined
                    }
                    href="/fleet"
                  />
                  <MatrixStatCard
                    label="Open Service Calls"
                    value={String(kpis?.openServiceCalls ?? 0)}
                    status={
                      (kpis?.criticalServiceCalls ?? 0) > 0
                        ? "attention"
                        : "neutral"
                    }
                    trend={
                      kpis
                        ? `${kpis.criticalServiceCalls} critical/emergency`
                        : undefined
                    }
                    href="/service-calls"
                  />
                  <MatrixStatCard
                    label="Machines at Risk"
                    value={String(kpis?.machinesAtRisk ?? 0)}
                    status={
                      (kpis?.machinesAtRisk ?? 0) > 0 ? "watch" : "ok"
                    }
                    href="/ai-operations/predictive-maintenance"
                  />
                  <MatrixStatCard
                    label="Preventive Maintenance Due"
                    value={String(kpis?.pmDue ?? 0)}
                    status={
                      (kpis?.pmOverdue ?? 0) > 0 ? "attention" : "watch"
                    }
                    trend={
                      kpis ? `${kpis.pmOverdue} overdue by meter` : undefined
                    }
                    href="/maintenance"
                  />
                  <MatrixStatCard
                    label="Critical Alerts"
                    value={String(kpis?.criticalAlerts ?? 0)}
                    status={
                      (kpis?.criticalAlerts ?? 0) > 0
                        ? "attention"
                        : "ok"
                    }
                    href="/ai-operations/predictive-maintenance/alerts"
                  />
                  <MatrixStatCard
                    label="Active Technicians"
                    value={String(kpis?.activeTechnicians ?? 0)}
                    status="neutral"
                    trend={kpis?.technicianCoverageLabel}
                    href="/dispatch"
                  />
                </div>
              </section>

              <section aria-labelledby="ecc-fleet-detail">
                <MatrixCard className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2
                        id="ecc-fleet-detail"
                        className="text-lg font-medium text-slate-100"
                      >
                        Fleet health foundation
                      </h2>
                      <p className="text-sm text-slate-400">
                        Explainable score from current Matrix signals — not a
                        precision forecast.
                      </p>
                    </div>
                    <MatrixButton
                      type="button"
                      variant="secondary"
                      onClick={() => setShowFactors((v) => !v)}
                    >
                      {showFactors ? "Hide factors" : "Why this score?"}
                    </MatrixButton>
                  </div>
                  {showFactors ? (
                    <ul className="space-y-2 text-sm text-slate-300">
                      {(fleet?.factors ?? []).map((f) => (
                        <li
                          key={f.key}
                          className="rounded-lg border border-slate-800 px-3 py-2"
                        >
                          <span className="font-medium text-slate-200">
                            {f.label}
                          </span>
                          :{" "}
                          {f.value == null ? (
                            <em className="text-slate-500">unavailable</em>
                          ) : (
                            String(f.value)
                          )}
                          {f.note ? (
                            <span className="block text-xs text-slate-500">
                              {f.note}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </MatrixCard>
              </section>

              <section aria-labelledby="ecc-briefing">
                <MatrixCard className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2
                        id="ecc-briefing"
                        className="text-lg font-medium text-slate-100"
                      >
                        AI Executive Briefing
                      </h2>
                      <p className="text-sm text-slate-400">
                        Plain-language summary. Facts and recommendations are
                        labeled separately. No actions are executed from this
                        panel.
                      </p>
                    </div>
                    <MatrixButton
                      type="button"
                      variant="secondary"
                      onClick={() => void refreshBriefing()}
                    >
                      Refresh briefing
                    </MatrixButton>
                  </div>
                  {summary.aiBriefing ? (
                    <>
                      <p className="text-sm text-slate-200">
                        {summary.aiBriefing.summary}
                      </p>
                      <ul className="space-y-2">
                        {summary.aiBriefing.priorities.map((p, idx) => (
                          <li
                            key={`${p.title}-${idx}`}
                            className="rounded-lg border border-slate-800 px-3 py-2 text-sm"
                          >
                            <span className="text-[10px] uppercase tracking-wide text-slate-500">
                              {p.kind === "fact" ? "Fact" : "Recommendation"}
                            </span>
                            <div className="font-medium text-slate-200">
                              {p.href ? (
                                <Link
                                  href={p.href}
                                  className="text-cyan-300 hover:underline"
                                >
                                  {p.title}
                                </Link>
                              ) : (
                                p.title
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{p.reason}</p>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-slate-500">
                        Generated{" "}
                        {new Date(
                          summary.aiBriefing.generatedAt,
                        ).toLocaleString()}{" "}
                        ·{" "}
                        {summary.aiBriefing.isSample
                          ? "Sample / local template (no paid AI required)"
                          : `${summary.aiBriefing.provider} / ${summary.aiBriefing.model}`}{" "}
                        · confidence {summary.aiBriefing.confidence}%
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Briefing unavailable. KPI panels below still reflect
                      current Matrix data when present.
                    </p>
                  )}
                </MatrixCard>
              </section>

              <section aria-labelledby="ecc-priorities">
                <MatrixCard className="space-y-3 p-4">
                  <h2
                    id="ecc-priorities"
                    className="text-lg font-medium text-slate-100"
                  >
                    Operational priorities
                  </h2>
                  <p className="text-sm text-slate-400">
                    Ranked by severity, overdue/risk, then recency. Opens the
                    existing Matrix screen for each item.
                  </p>
                  {summary.priorities.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No high-priority items right now.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {summary.priorities.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-xl border border-slate-800 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase ${severityClass(item.severity)}`}
                            >
                              {item.severity}
                            </span>
                            <span className="text-[10px] uppercase text-slate-500">
                              {item.source}
                            </span>
                          </div>
                          <Link
                            href={item.href}
                            className="mt-1 block font-medium text-cyan-300 hover:underline"
                          >
                            {item.title}
                          </Link>
                          <p className="text-sm text-slate-400">{item.reason}</p>
                          <p className="mt-1 text-xs text-slate-300">
                            Next step: {item.recommendedNextStep}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[item.customerName, item.siteName, item.machineId]
                              .filter(Boolean)
                              .join(" · ") || "Scope not tagged"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </MatrixCard>
              </section>

              <section aria-labelledby="ecc-panels">
                <h2
                  id="ecc-panels"
                  className="mb-3 text-lg font-medium text-slate-100"
                >
                  Enterprise status
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {summary.panels.map((panel) => (
                    <MatrixCard key={panel.key} className="space-y-2 p-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${panelStatusDot(panel.status)}`}
                          aria-hidden
                        />
                        <h3 className="font-medium text-slate-100">
                          {panel.title}
                        </h3>
                      </div>
                      <p className="text-sm text-slate-400">{panel.headline}</p>
                      <ul className="space-y-1 text-xs text-slate-400">
                        {panel.items.length === 0 ? (
                          <li>No detail rows yet.</li>
                        ) : (
                          panel.items.map((row) => (
                            <li key={`${panel.key}-${row.label}`}>
                              {row.href ? (
                                <Link
                                  href={row.href}
                                  className="text-cyan-300 hover:underline"
                                >
                                  {row.label}
                                </Link>
                              ) : (
                                row.label
                              )}
                              : {row.value}
                            </li>
                          ))
                        )}
                      </ul>
                      <Link
                        href={panel.href}
                        className="inline-block text-xs text-cyan-300 hover:underline"
                      >
                        Open related screen →
                      </Link>
                    </MatrixCard>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>
  );
}

export default function ExecutiveCommandCenterPage() {
  return (
    <MatrixShell
      title="Executive Command Center"
      activePath="/executive-command-center"
    >
      <MatrixAuthGuard
        requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}
      >
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <ExecutiveCommandCenterBody />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
