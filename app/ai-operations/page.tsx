"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { AiDashboardSummary, AiOpsInsightDto } from "@/lib/ai/insight-types";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "../components/ui";

type Tab = "overview" | "insights" | "trends" | "runs" | "health";

const ADVISORY =
  "AI-generated insights are advisory and may be incomplete or inaccurate. Review supporting records before making operational decisions.";

function severityLabel(s: string) {
  return `${s}`;
}

export default function AiOperationsDashboardPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_AI_OPERATIONS");
  const canReview = hasMatrixPermission(role, "REVIEW_AI_INSIGHTS");
  const canRun = hasMatrixPermission(role, "RUN_AI_ANALYSIS");
  const canHealth = hasMatrixPermission(role, "VIEW_AI_HEALTH");
  const canAssistant = hasMatrixPermission(role, "VIEW_AI_ASSISTANT");

  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<AiDashboardSummary | null>(null);
  const [insights, setInsights] = useState<AiOpsInsightDto[]>([]);
  const [selected, setSelected] = useState<AiOpsInsightDto | null>(null);
  const [events, setEvents] = useState<
    Array<{ id: string; action: string; createdAt: string; note: string | null }>
  >([]);
  const [trends, setTrends] = useState<{
    empty?: boolean;
    message?: string | null;
    series?: Array<{ date: string; created: number; critical: number; resolved: number }>;
  } | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [sort, setSort] = useState("severity");
  const [days, setDays] = useState("30");
  const [searchQ, setSearchQ] = useState("");
  const [confirmRun, setConfirmRun] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [resolveSummary, setResolveSummary] = useState("");

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/ai-operations/dashboard", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error ?? "Dashboard failed");
    setDashboard(json.dashboard);
  }, []);

  const loadInsights = useCallback(async () => {
    const params = new URLSearchParams({ sort, pageSize: "50" });
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    if (moduleFilter) params.set("sourceModule", moduleFilter);
    if (searchQ.trim()) params.set("q", searchQ.trim());
    const res = await fetch(`/api/ai-operations/insights?${params}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error ?? "Insights failed");
    setInsights(json.items);
  }, [severity, status, moduleFilter, sort, searchQ]);

  const loadTrends = useCallback(async () => {
    const res = await fetch(`/api/ai-operations/trends?days=${days}`, {
      cache: "no-store",
    });
    const json = await res.json();
    setTrends(json);
  }, [days]);

  const loadHealth = useCallback(async () => {
    if (!canHealth) return;
    const res = await fetch("/api/ai-operations/health", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setHealth(json.health);
  }, [canHealth]);

  const loadRuns = useCallback(async () => {
    if (!canHealth) return;
    const res = await fetch("/api/ai-operations/analysis/runs", {
      cache: "no-store",
    });
    const json = await res.json();
    if (json.ok) setRuns(json.items ?? []);
  }, [canHealth]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([
        loadDashboard(),
        loadInsights(),
        loadTrends(),
        loadHealth(),
        loadRuns(),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load AI Operations.");
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadInsights, loadTrends, loadHealth, loadRuns]);

  useEffect(() => {
    if (!canView) return;
    void refresh();
  }, [canView, refresh]);

  const openInsight = async (id: string) => {
    const res = await fetch(`/api/ai-operations/insights/${id}`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (json.ok) {
      setSelected(json.insight);
      setEvents(json.events ?? []);
    }
  };

  const postAction = async (
    path: string,
    body?: Record<string, unknown>,
  ) => {
    setError("");
    setMessage("");
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Action failed");
      return;
    }
    setMessage("Insight updated.");
    setSelected(json.insight ?? selected);
    await refresh();
    if (json.insight) await openInsight(json.insight.id);
  };

  const riskMatrix = useMemo(() => {
    const groups: Record<string, AiOpsInsightDto[]> = {
      ACT_NOW: [],
      PLAN_NEXT: [],
      MONITOR: [],
      LOW_PRIORITY: [],
    };
    for (const i of insights) {
      if (["RESOLVED", "DISMISSED", "ARCHIVED"].includes(i.status)) continue;
      (groups[i.riskCategory] ?? groups.MONITOR)!.push(i);
    }
    return groups;
  }, [insights]);

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-white">AI Operations Center</h1>
        <p className="mt-3 text-sm text-rose-300">
          You do not have permission to view AI Operations.
        </p>
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "overview", label: "Overview", show: true },
    { id: "insights", label: "Insights", show: true },
    { id: "trends", label: "Trends", show: true },
    { id: "runs", label: "Analysis Runs", show: canHealth },
    { id: "health", label: "AI Health", show: canHealth },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Operations Center</h1>
          <p className="mt-1 text-sm text-slate-400">
            Advisory operational insights across service, fleet, PM, inventory, and
            data quality.
          </p>
        </div>
        {canRun ? (
          <MatrixButton onClick={() => setConfirmRun(true)}>
            Run AI Analysis
          </MatrixButton>
        ) : null}
      </div>

      <p
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
        role="note"
      >
        {dashboard?.advisoryNotice ?? ADVISORY}
      </p>

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-300" role="status">
          {message}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-400">Loading AI Operations…</p> : null}

      <nav aria-label="AI Operations tabs" className="flex flex-wrap gap-2">
        {canAssistant ? (
          <Link
            href="/ai-operations/assistant"
            className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Assistant
          </Link>
        ) : null}
        {hasMatrixPermission(role, "VIEW_AI_AUTOMATIONS") ? (
          <Link
            href="/ai-operations/automations"
            className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Automations
          </Link>
        ) : null}
        {hasMatrixPermission(role, "VIEW_PREDICTIVE_MAINTENANCE") ? (
          <Link
            href="/ai-operations/predictive-maintenance"
            className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Predictive Maintenance
          </Link>
        ) : null}
        {hasMatrixPermission(role, "VIEW_DECISION_CENTER") ? (
          <Link
            href="/ai-operations/decisions"
            className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Decision Engine
          </Link>
        ) : null}
        {hasMatrixPermission(role, "VIEW_EXECUTIVE_COMMAND_CENTER") ? (
          <Link
            href="/executive-command-center"
            className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Executive Command Center
          </Link>
        ) : null}
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              className={`rounded-lg border px-3 py-2 text-sm ${
                tab === t.id
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                  : "border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
      </nav>

      {tab === "overview" && dashboard ? (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <MatrixStatCard label="AI Status" value={dashboard.serviceStatus} />
            <MatrixStatCard
              label="Active Insights"
              value={String(dashboard.activeInsights)}
            />
            <MatrixStatCard
              label="Critical / High"
              value={String(dashboard.criticalRecommendations)}
            />
            <MatrixStatCard
              label="Anomalies"
              value={String(dashboard.unresolvedAnomalies)}
            />
            <MatrixStatCard
              label="Pending Review"
              value={String(dashboard.pendingHumanReviews)}
            />
            <MatrixStatCard
              label="Avg Confidence"
              value={`${dashboard.averageConfidence}%`}
            />
            <MatrixStatCard label="Data Freshness" value={dashboard.dataFreshness} />
            <MatrixStatCard
              label="DQ Warnings"
              value={String(dashboard.dataQualityWarnings)}
            />
          </div>

          <MatrixCard title="AI Executive Briefing">
            <p className="text-sm leading-relaxed text-slate-200">
              {dashboard.briefing.text}
            </p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Overall condition</dt>
                <dd className="text-slate-200">{dashboard.briefing.overallCondition}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Confidence</dt>
                <dd className="text-slate-200">{dashboard.briefing.confidence}%</dd>
              </div>
              <div>
                <dt className="text-slate-500">Most urgent risk</dt>
                <dd className="text-slate-200">{dashboard.briefing.mostUrgentRisk}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Highest-priority action</dt>
                <dd className="text-slate-200">
                  {dashboard.briefing.highestPriorityAction}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Data gaps</dt>
                <dd className="text-slate-200">{dashboard.briefing.dataGaps}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Analyzed at</dt>
                <dd className="text-slate-200">
                  {dashboard.briefing.analyzedAt
                    ? new Date(dashboard.briefing.analyzedAt).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
          </MatrixCard>

          <MatrixCard title="AI Coverage">
            <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <li>Machines analyzed: {dashboard.coverage.machinesAnalyzed}</li>
              <li>Customers analyzed: {dashboard.coverage.customersAnalyzed}</li>
              <li>Service calls analyzed: {dashboard.coverage.serviceCallsAnalyzed}</li>
              <li>PM records analyzed: {dashboard.coverage.pmRecordsAnalyzed}</li>
              <li>
                Inventory records analyzed:{" "}
                {dashboard.coverage.inventoryRecordsAnalyzed}
              </li>
            </ul>
            {dashboard.coverage.excludedSources.length > 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Excluded: {dashboard.coverage.excludedSources.join("; ")}
              </p>
            ) : null}
          </MatrixCard>

          <MatrixCard title="Module Coverage">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["SERVICE", "Service Operations", "/service-calls"],
                  ["PM", "Preventive Maintenance", "/maintenance"],
                  ["FLEET", "Machine & Fleet Health", "/digital-twin"],
                  ["INVENTORY", "Inventory & Parts", "/inventory"],
                  ["DATA_QUALITY", "Data Quality", "/admin/data-quality"],
                  ["GENERAL", "General", "/ai-operations"],
                ] as const
              ).map(([key, label, href]) => (
                <div
                  key={key}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                >
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="mt-1 text-2xl text-cyan-200">
                    {dashboard.moduleCounts[key]}
                  </p>
                  <p className="text-xs text-slate-500">active insights</p>
                  <Link
                    href={href}
                    className="mt-2 inline-block text-xs text-cyan-400 hover:underline"
                  >
                    Open module
                  </Link>
                </div>
              ))}
            </div>
          </MatrixCard>

          <MatrixCard title="Risk & Opportunity Matrix">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(riskMatrix).map(([key, items]) => (
                <div
                  key={key}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {key.replace("_", " ")}
                  </p>
                  <p className="mt-1 text-lg text-white">{items.length}</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-400">
                    {items.slice(0, 4).map((i) => (
                      <li key={i.id}>
                        <button
                          type="button"
                          className="text-left text-cyan-300 hover:underline"
                          onClick={() => void openInsight(i.id)}
                        >
                          [{severityLabel(i.severity)}] {i.title}
                        </button>
                      </li>
                    ))}
                    {items.length === 0 ? (
                      <li className="text-slate-600">No items</li>
                    ) : null}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">
                  Accessible list alternative for risk matrix
                </caption>
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-1">Category</th>
                    <th className="px-2 py-1">Insight</th>
                    <th className="px-2 py-1">Severity</th>
                    <th className="px-2 py-1">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(riskMatrix).flatMap(([cat, items]) =>
                    items.map((i) => (
                      <tr key={`${cat}-${i.id}`} className="border-t border-slate-800">
                        <td className="px-2 py-1 text-slate-400">{cat}</td>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            className="text-cyan-300 hover:underline"
                            onClick={() => void openInsight(i.id)}
                          >
                            {i.title}
                          </button>
                        </td>
                        <td className="px-2 py-1">{i.severity}</td>
                        <td className="px-2 py-1">{Math.round(i.confidence)}%</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </MatrixCard>

          <MatrixCard title="Quick Links">
            <div className="flex flex-wrap gap-2">
              {dashboard.quickLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-cyan-500/40"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </MatrixCard>
        </div>
      ) : null}

      {tab === "insights" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm text-slate-400">
              Severity
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="">All</option>
                {["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Status
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                {[
                  "NEW",
                  "REVIEWING",
                  "ACKNOWLEDGED",
                  "ACTION_REQUIRED",
                  "RESOLVED",
                  "DISMISSED",
                  "ARCHIVED",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Module
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                <option value="">All</option>
                {["SERVICE", "PM", "FLEET", "INVENTORY", "DATA_QUALITY", "GENERAL"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Sort
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="severity">Highest severity</option>
                <option value="confidence">Highest confidence</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="updated">Most recently updated</option>
              </select>
            </label>
            <label className="text-sm text-slate-400 sm:col-span-2 lg:col-span-4">
              Search insights
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Title, summary, customer, machine…"
                aria-label="Search AI insights"
              />
            </label>
          </div>

          {insights.length === 0 ? (
            <p className="text-sm text-slate-500">
              No AI insights are currently available. Run an analysis after Matrix
              contains sufficient operational data.
            </p>
          ) : (
            <ul className="space-y-2">
              {insights.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-left hover:border-cyan-500/40"
                    onClick={() => void openInsight(i.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-white">{i.title}</p>
                      <span className="text-xs text-slate-400">
                        {i.severity} · {Math.round(i.confidence)}% · {i.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{i.summary}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {i.sourceModule} · {i.insightType}
                      {i.machineLabel ? ` · ${i.machineLabel}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "trends" ? (
        <MatrixCard title="AI Trends">
          <label className="mb-3 block max-w-xs text-sm text-slate-400">
            Date range
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">This Year</option>
            </select>
          </label>
          {trends?.empty ? (
            <p className="text-sm text-slate-500">{trends.message}</p>
          ) : (
            <ul className="space-y-2 text-sm" aria-label="Insights created over time">
              {(trends?.series ?? []).map((row) => (
                <li key={row.date} className="flex items-center gap-3">
                  <span className="w-28 text-slate-500">{row.date}</span>
                  <span
                    className="h-2 rounded bg-cyan-500/70"
                    style={{ width: `${Math.min(100, row.created * 12)}%` }}
                    title={`${row.created} created`}
                  />
                  <span className="text-slate-300">
                    {row.created} created · {row.critical} critical/high ·{" "}
                    {row.resolved} resolved
                  </span>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      ) : null}

      {tab === "runs" ? (
        <MatrixCard title="Analysis Runs">
          {runs.length === 0 ? (
            <p className="text-sm text-slate-500">No completed analysis runs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {runs.map((r) => (
                <li
                  key={String(r.id)}
                  className="rounded-lg border border-slate-800 px-3 py-2 text-slate-300"
                >
                  {String(r.status)} · insights {String(r.insightsCreated)} · analyzed{" "}
                  {String(r.recordsAnalyzed)} ·{" "}
                  {r.createdAt
                    ? new Date(String(r.createdAt)).toLocaleString()
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      ) : null}

      {tab === "health" && health ? (
        <MatrixCard title="AI System Health">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">State</dt>
              <dd className="text-white">{String(health.state)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Configuration version</dt>
              <dd className="text-white">{String(health.configurationVersion)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Rules version</dt>
              <dd className="text-white">{String(health.rulesVersion)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Last successful analysis</dt>
              <dd className="text-white">
                {health.lastSuccessfulAnalysisAt
                  ? new Date(String(health.lastSuccessfulAnalysisAt)).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Last failed analysis</dt>
              <dd className="text-white">
                {health.lastFailedAnalysisAt
                  ? new Date(String(health.lastFailedAnalysisAt)).toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Latest error</dt>
              <dd className="text-white">
                {health.latestErrorSummary
                  ? String(health.latestErrorSummary)
                  : "None"}
              </dd>
            </div>
          </dl>
        </MatrixCard>
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Insight detail"
        >
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Close insight detail"
            onClick={() => setSelected(null)}
          />
          <aside className="h-full w-full max-w-lg overflow-y-auto border-l border-slate-800 bg-slate-950 p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-xl font-semibold text-white">{selected.title}</h2>
              <button
                type="button"
                className="text-slate-400 hover:text-white"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            <p className="text-sm text-slate-300">{selected.summary}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Severity / Confidence / Status</dt>
                <dd className="text-slate-200">
                  {selected.severity} · {Math.round(selected.confidence)}% ·{" "}
                  {selected.status}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Why generated</dt>
                <dd className="text-slate-200">{selected.explanation}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Recommended action</dt>
                <dd className="text-slate-200">{selected.recommendedAction}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Limitations</dt>
                <dd className="text-slate-200">{selected.limitations ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Analysis version</dt>
                <dd className="text-slate-200">{selected.analysisVersion}</dd>
              </div>
              {selected.machineLabel ? (
                <div>
                  <dt className="text-slate-500">Machine</dt>
                  <dd className="text-slate-200">{selected.machineLabel}</dd>
                </div>
              ) : null}
              {selected.customerName ? (
                <div>
                  <dt className="text-slate-500">Customer</dt>
                  <dd className="text-slate-200">{selected.customerName}</dd>
                </div>
              ) : null}
              {selected.relatedRecordHref ? (
                <div>
                  <dt className="text-slate-500">Related record</dt>
                  <dd>
                    <Link
                      href={selected.relatedRecordHref}
                      className="text-cyan-300 hover:underline"
                    >
                      Open in Matrix
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>

            {canReview ? (
              <div className="mt-6 space-y-3 border-t border-slate-800 pt-4">
                <p className="text-sm font-medium text-white">Human review</p>
                <div className="flex flex-wrap gap-2">
                  <MatrixButton
                    variant="secondary"
                    onClick={() =>
                      void postAction(
                        `/api/ai-operations/insights/${selected.id}/acknowledge`,
                      )
                    }
                  >
                    Acknowledge
                  </MatrixButton>
                  <MatrixButton
                    variant="secondary"
                    onClick={() =>
                      void postAction(
                        `/api/ai-operations/insights/${selected.id}/assign`,
                        {
                          assignedReviewerId: user?.id ?? "dev-user",
                          assignedReviewerName: user?.fullName ?? "Matrix User",
                        },
                      )
                    }
                  >
                    Assign to me
                  </MatrixButton>
                </div>
                <label className="block text-sm text-slate-400">
                  Resolution summary
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={resolveSummary}
                    onChange={(e) => setResolveSummary(e.target.value)}
                  />
                </label>
                <MatrixButton
                  onClick={() =>
                    void postAction(
                      `/api/ai-operations/insights/${selected.id}/resolve`,
                      { resolutionSummary: resolveSummary },
                    )
                  }
                >
                  Resolve
                </MatrixButton>
                <label className="block text-sm text-slate-400">
                  Dismissal reason
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    value={dismissReason}
                    onChange={(e) => setDismissReason(e.target.value)}
                  />
                </label>
                <MatrixButton
                  variant="danger"
                  onClick={() =>
                    void postAction(
                      `/api/ai-operations/insights/${selected.id}/dismiss`,
                      { dismissalReason: dismissReason },
                    )
                  }
                >
                  Dismiss
                </MatrixButton>
                {selected.status === "DISMISSED" ? (
                  <MatrixButton
                    variant="secondary"
                    onClick={() =>
                      void postAction(
                        `/api/ai-operations/insights/${selected.id}/restore`,
                      )
                    }
                  >
                    Restore
                  </MatrixButton>
                ) : null}
                {selected.status === "RESOLVED" ? (
                  <MatrixButton
                    variant="secondary"
                    onClick={() =>
                      void postAction(
                        `/api/ai-operations/insights/${selected.id}/archive`,
                      )
                    }
                  >
                    Archive
                  </MatrixButton>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-medium text-white">Audit history</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {events.map((e) => (
                  <li key={e.id}>
                    {new Date(e.createdAt).toLocaleString()} · {e.action}
                    {e.note ? ` — ${e.note}` : ""}
                  </li>
                ))}
                {events.length === 0 ? <li>No events yet.</li> : null}
              </ul>
            </div>
          </aside>
        </div>
      ) : null}

      {confirmRun ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="run-ai-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 p-5">
            <h2 id="run-ai-title" className="text-lg font-semibold text-white">
              Run AI Analysis
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Analysis may take time. Results are advisory. Existing operational
              records will not be modified. New insights may be created.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <MatrixButton
                variant="secondary"
                onClick={() => setConfirmRun(false)}
              >
                Cancel
              </MatrixButton>
              <MatrixButton
                onClick={() => {
                  setConfirmRun(false);
                  void (async () => {
                    const res = await fetch("/api/ai-operations/analysis/run", {
                      method: "POST",
                    });
                    const json = await res.json();
                    if (!res.ok || !json.ok) {
                      setError(json.error ?? "Analysis failed to start");
                      return;
                    }
                    setMessage(
                      `Analysis ${json.run.status}. Insights created: ${json.run.insightsCreated}`,
                    );
                    await refresh();
                  })();
                }}
              >
                Confirm run
              </MatrixButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
