"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MatrixShell from "@/app/components/MatrixShell";
import MatrixAuthGuard from "@/app/components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "@/app/components/ui";
import ExecutiveNav from "../ExecutiveNav";

type AnalyticsPayload = {
  enabled: boolean;
  message?: string;
  generatedAt?: string;
  horizon?: string;
  serviceDemand?: {
    meta: {
      methodLabel: string;
      confidence: number | null;
      confidenceNote: string;
      dataFreshness: string;
      horizonLabel: string;
      assumptions: string[];
      warnings: string[];
    };
    nextPeriodForecast: number | null;
    actualInHorizonWindow: number;
    byCustomer: Array<{ label: string; actual: number; forecast: number }>;
    byModel: Array<{ label: string; actual: number; forecast: number }>;
  };
  pmWorkload?: {
    meta: { methodLabel: string; warnings: string[]; assumptions: string[] };
    actual: { overdueNow: number; dueSoon: number; activeMachines: number };
    forecast: { jobsInHorizon: number | null };
  };
  partsDemand?: {
    meta: { methodLabel: string; warnings: string[] };
    nextPeriodForecast: number | null;
    stockoutRisk: Array<{
      partNumber: string;
      risk: string;
      daysOfCover: number | null;
      href: string;
    }>;
  };
  machineReliability?: {
    actual: {
      repeatCallMachines: number;
      openDownCalls: number;
      firstTimeFixRate: number | null;
    };
    machines: Array<{
      machineId: string;
      callCount90d: number;
      repeatFlag: boolean;
      href: string;
    }>;
  };
  customerRisk?: {
    customers: Array<{
      customerId: string;
      name: string;
      baseScore: number;
      effectiveScore: number;
      riskLabel: string;
      factors: Array<{ note: string; penalty: number }>;
      href: string;
    }>;
  };
  technicianCapacity?: {
    forecast: {
      demandHours: number | null;
      capacityHours: number | null;
      gapHours: number | null;
    };
    meta: { methodLabel: string; assumptions: string[] };
  };
  accuracy?: {
    rows: Array<{
      domain: string;
      actual: number;
      forecast: number | null;
      percentError: number | null;
      note: string;
    }>;
  };
  dataQuality?: {
    overallSufficient: boolean;
    lastRefreshAt: string;
    sources: Array<{
      source: string;
      recordCount: number;
      staleOrMissing: number;
      sufficient: boolean;
      note: string;
    }>;
    warnings: string[];
  };
  safety?: Record<string, boolean>;
};

function MetaBlock({
  meta,
}: {
  meta?: {
    metric?: string;
    scope?: string;
    methodLabel?: string;
    methodVersion?: string;
    confidence?: number | null;
    confidenceLow?: number | null;
    confidenceHigh?: number | null;
    confidenceNote?: string;
    dataFreshness?: string;
    dataSufficient?: boolean;
    horizonLabel?: string;
    sourceDataCutoff?: string | null;
    generatedAt?: string;
    assumptions?: string[];
    warnings?: string[];
    recordCount?: number;
  };
}) {
  if (!meta) return null;
  return (
    <div className="mt-2 space-y-1 text-xs text-slate-500">
      <p>
        {meta.metric ? `${meta.metric} · ` : ""}
        {meta.scope ? `scope ${meta.scope} · ` : ""}
        Method: {meta.methodLabel}
        {meta.methodVersion ? ` (${meta.methodVersion})` : ""}
        {meta.horizonLabel ? ` · ${meta.horizonLabel}` : ""}
        {meta.dataFreshness ? ` · freshness ${meta.dataFreshness}` : ""}
        {meta.confidence != null ? ` · confidence ${meta.confidence}%` : ""}
        {meta.dataSufficient != null
          ? ` · sufficient ${meta.dataSufficient ? "yes" : "no"}`
          : ""}
      </p>
      {meta.confidenceLow != null && meta.confidenceHigh != null ? (
        <p>
          Bounds (when supportable): {meta.confidenceLow} – {meta.confidenceHigh}
        </p>
      ) : null}
      {meta.sourceDataCutoff ? (
        <p>Source cutoff: {new Date(meta.sourceDataCutoff).toLocaleString()}</p>
      ) : null}
      {meta.recordCount != null ? <p>Records: {meta.recordCount}</p> : null}
      {meta.confidenceNote ? <p>{meta.confidenceNote}</p> : null}
      {(meta.assumptions ?? []).slice(0, 2).map((a) => (
        <p key={a}>Assumption: {a}</p>
      ))}
      {(meta.warnings ?? []).map((w) => (
        <p key={w} className="text-amber-300">
          Warning: {w}
        </p>
      ))}
    </div>
  );
}

function Body() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "LAST_30";
  const horizon = searchParams.get("horizon") || "MONTH";
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scenarioMsg, setScenarioMsg] = useState("");
  const [deltas, setDeltas] = useState({
    serviceDemandDeltaPct: 10,
    pmWorkloadDeltaPct: 0,
    partsDemandDeltaPct: 5,
    technicianCapacityDeltaPct: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/executive-command-center/predictive-analytics?horizon=${encodeURIComponent(horizon)}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load");
      setAnalytics(json.analytics);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [horizon]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  function setHorizon(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("horizon", next);
    router.push(`?${params.toString()}`);
  }

  function setRange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.push(`?${params.toString()}`);
  }

  async function runScenario() {
    setScenarioMsg("");
    const res = await fetch(
      "/api/executive-command-center/predictive-analytics/scenarios",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "UI what-if", ...deltas }),
      },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setScenarioMsg(json.error ?? "Scenario failed");
      return;
    }
    const s = json.scenario;
    setScenarioMsg(
      `What-if only (mutatesLiveRecords=${s.mutatesLiveRecords}): service ${s.projected.serviceDemand}, PM ${s.projected.pmJobs}, parts ${s.projected.partsUnits}, capacity gap ${s.projected.capacityGapHours}h`,
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-1 py-2">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">
          Predictive Business Analytics
        </h1>
        <p className="max-w-3xl text-sm text-slate-400">
          Executive Intelligence forecasts for service demand, PM workload,
          parts, reliability, customer risk, and capacity. Actuals and forecasts
          stay separate; scenarios never change live records.
        </p>
      </header>

      <ExecutiveNav range={range} onRangeChange={setRange} />

      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        Forecast horizon
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-200"
          value={horizon}
          onChange={(e) => setHorizon(e.target.value)}
        >
          <option value="WEEK">Week</option>
          <option value="MONTH">Month</option>
          <option value="QUARTER">Quarter</option>
        </select>
        <MatrixButton type="button" variant="secondary" onClick={() => void load()}>
          Refresh
        </MatrixButton>
        <Link
          href="/executive-command-center/ai-insights"
          className="text-cyan-300 hover:underline"
        >
          Ask Assist →
        </Link>
      </label>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      ) : null}

      {loading && !analytics ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-800/60" />
      ) : null}

      {analytics && !analytics.enabled ? (
        <MatrixCard className="p-6">
          <p className="text-sm text-slate-400">{analytics.message}</p>
        </MatrixCard>
      ) : null}

      {analytics?.enabled ? (
        <>
          <p className="text-xs text-slate-500">
            Generated {analytics.generatedAt ? new Date(analytics.generatedAt).toLocaleString() : "—"}
            {" · "}
            Auto-order/PM/assign: off
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MatrixStatCard
              label="Service demand (forecast)"
              value={
                analytics.serviceDemand?.nextPeriodForecast == null
                  ? "—"
                  : String(analytics.serviceDemand.nextPeriodForecast)
              }
              trend={`Actual recent window: ${analytics.serviceDemand?.actualInHorizonWindow ?? 0}`}
            />
            <MatrixStatCard
              label="PM jobs in horizon"
              value={
                analytics.pmWorkload?.forecast.jobsInHorizon == null
                  ? "—"
                  : String(analytics.pmWorkload.forecast.jobsInHorizon)
              }
              trend={`Overdue ${analytics.pmWorkload?.actual.overdueNow ?? 0} · due soon ${analytics.pmWorkload?.actual.dueSoon ?? 0}`}
            />
            <MatrixStatCard
              label="Parts demand (forecast)"
              value={
                analytics.partsDemand?.nextPeriodForecast == null
                  ? "—"
                  : String(analytics.partsDemand.nextPeriodForecast)
              }
            />
            <MatrixStatCard
              label="Capacity gap (hours)"
              value={
                analytics.technicianCapacity?.forecast.gapHours == null
                  ? "—"
                  : String(analytics.technicianCapacity.forecast.gapHours)
              }
              status={
                (analytics.technicianCapacity?.forecast.gapHours ?? 0) > 0
                  ? "watch"
                  : "ok"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <MatrixCard className="p-4">
              <h2 className="text-lg font-medium text-slate-100">
                Service demand
              </h2>
              <MetaBlock meta={analytics.serviceDemand?.meta} />
              <ul className="mt-3 space-y-1 text-sm text-slate-300">
                {(analytics.serviceDemand?.byCustomer ?? []).slice(0, 6).map((r) => (
                  <li key={r.label}>
                    {r.label}: actual {r.actual} · forecast share {r.forecast}
                  </li>
                ))}
              </ul>
            </MatrixCard>

            <MatrixCard className="p-4">
              <h2 className="text-lg font-medium text-slate-100">
                Parts stockout risk
              </h2>
              <MetaBlock meta={analytics.partsDemand?.meta} />
              <ul className="mt-3 space-y-1 text-sm">
                {(analytics.partsDemand?.stockoutRisk ?? []).slice(0, 8).map((p) => (
                  <li key={p.partNumber} className="flex justify-between gap-2">
                    <Link href={p.href} className="text-cyan-300 hover:underline">
                      {p.partNumber}
                    </Link>
                    <span className="text-slate-400">
                      {p.risk}
                      {p.daysOfCover != null ? ` · ${p.daysOfCover}d cover` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </MatrixCard>

            <MatrixCard className="p-4">
              <h2 className="text-lg font-medium text-slate-100">
                Machine reliability
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Repeat machines: {analytics.machineReliability?.actual.repeatCallMachines ?? 0}
                {" · "}
                Open down/critical: {analytics.machineReliability?.actual.openDownCalls ?? 0}
                {" · "}
                First-time fix:{" "}
                {analytics.machineReliability?.actual.firstTimeFixRate == null
                  ? "—"
                  : `${analytics.machineReliability.actual.firstTimeFixRate}%`}
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {(analytics.machineReliability?.machines ?? [])
                  .filter((m) => m.repeatFlag)
                  .slice(0, 8)
                  .map((m) => (
                    <li key={m.machineId}>
                      <Link href={m.href} className="text-cyan-300 hover:underline">
                        {m.machineId}
                      </Link>{" "}
                      <span className="text-slate-500">{m.callCount90d} calls/90d</span>
                    </li>
                  ))}
              </ul>
            </MatrixCard>

            <MatrixCard className="p-4">
              <h2 className="text-lg font-medium text-slate-100">
                Customer Service Health
              </h2>
              <p className="text-xs text-slate-500">
                Internal executive score — not exposed on customer portal APIs.
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {(analytics.customerRisk?.customers ?? []).slice(0, 8).map((c) => (
                  <li key={c.customerId} className="border-b border-slate-800 pb-2">
                    <Link href={c.href} className="text-cyan-300 hover:underline">
                      {c.name}
                    </Link>
                    <span className="ml-2 text-slate-400">
                      score {c.effectiveScore} ({c.riskLabel})
                      {c.baseScore !== c.effectiveScore
                        ? ` · base ${c.baseScore}`
                        : ""}
                    </span>
                    <p className="text-xs text-slate-500">
                      {(c.factors ?? [])
                        .slice(0, 2)
                        .map((f) => f.note)
                        .join("; ") || "No penalties"}
                    </p>
                  </li>
                ))}
              </ul>
            </MatrixCard>
          </div>

          <MatrixCard className="space-y-3 p-4">
            <h2 className="text-lg font-medium text-slate-100">
              Scenario planner
            </h2>
            <p className="text-xs text-slate-500">
              What-if only — never auto-orders parts, changes PM, or assigns techs.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["serviceDemandDeltaPct", "Service demand %"],
                  ["pmWorkloadDeltaPct", "PM workload %"],
                  ["partsDemandDeltaPct", "Parts demand %"],
                  ["technicianCapacityDeltaPct", "Tech capacity %"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-xs text-slate-400">
                  {label}
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
                    value={deltas[key]}
                    onChange={(e) =>
                      setDeltas((d) => ({
                        ...d,
                        [key]: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <MatrixButton type="button" onClick={() => void runScenario()}>
              Run scenario
            </MatrixButton>
            {scenarioMsg ? (
              <p className="text-sm text-emerald-300" role="status">
                {scenarioMsg}
              </p>
            ) : null}
          </MatrixCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <MatrixCard className="p-4">
              <h2 className="text-lg font-medium text-slate-100">
                Forecast vs actual
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {(analytics.accuracy?.rows ?? []).map((r) => (
                  <li key={r.domain}>
                    <span className="font-medium">{r.domain}</span>: actual{" "}
                    {r.actual}, forecast {r.forecast ?? "—"}, err%{" "}
                    {r.percentError ?? "—"}
                    <p className="text-xs text-slate-500">{r.note}</p>
                  </li>
                ))}
              </ul>
            </MatrixCard>

            <MatrixCard className="p-4">
              <h2 className="text-lg font-medium text-slate-100">
                Data quality
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Overall sufficient:{" "}
                {analytics.dataQuality?.overallSufficient ? "yes" : "no"} · refreshed{" "}
                {analytics.dataQuality?.lastRefreshAt
                  ? new Date(analytics.dataQuality.lastRefreshAt).toLocaleString()
                  : "—"}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-400">
                {(analytics.dataQuality?.sources ?? []).map((s) => (
                  <li key={s.source}>
                    {s.source}: {s.recordCount} records
                    {s.sufficient ? "" : " (insufficient)"}
                    {s.staleOrMissing
                      ? ` · stale/missing ${s.staleOrMissing}`
                      : ""}
                  </li>
                ))}
              </ul>
              {(analytics.dataQuality?.warnings ?? []).map((w) => (
                <p key={w} className="mt-1 text-xs text-amber-300">
                  {w}
                </p>
              ))}
            </MatrixCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function PredictiveBusinessAnalyticsPage() {
  return (
    <MatrixShell
      title="Predictive Business Analytics"
      activePath="/executive-command-center"
    >
      <MatrixAuthGuard
        requiredPermissions={["VIEW_EXECUTIVE_COMMAND_CENTER"]}
      >
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <Body />
        </Suspense>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
