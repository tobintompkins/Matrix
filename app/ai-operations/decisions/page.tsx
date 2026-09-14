"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "../../components/ui";

type DecisionItem = {
  id: string;
  title: string;
  summary: string;
  decisionType: string;
  priority: string;
  status: string;
  overallDecisionScore: number;
  confidenceScore: number;
  machineId: string | null;
  customerId: string | null;
  recommendedAction: string;
  highImpact: boolean;
  estimatedCostAvoidance: number | null;
  costsHidden?: boolean;
};

type Summary = {
  critical: number;
  awaitingReview: number;
  approvedInProgress: number;
  estimatedDowntimeAvoidedMinutes: number;
  estimatedCostAvoided: number | null;
  costsHidden?: boolean;
  empty: boolean;
  topDecisions: DecisionItem[];
  fleetRisk: Array<{ name: string; decisions: number; avgRisk: number }>;
  topMachines: Array<{
    machineId: string;
    title: string;
    priority: string;
    overallDecisionScore: number;
    decisionId: string;
  }>;
  slaThreats: DecisionItem[];
  acceptanceRate: number | null;
  completedSeries: Array<{ date: string; count: number }>;
  predictedDowntimeMinutes: number;
};

function badgeClass(priority: string) {
  if (priority === "CRITICAL") return "bg-rose-500/15 text-rose-200 border-rose-500/40";
  if (priority === "HIGH") return "bg-amber-500/15 text-amber-200 border-amber-500/40";
  if (priority === "MEDIUM") return "bg-sky-500/15 text-sky-200 border-sky-500/40";
  return "bg-slate-500/15 text-slate-300 border-slate-500/40";
}

export default function DecisionCenterPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canRun = hasMatrixPermission(role, "RUN_DECISION_ENGINE");
  const canApprove = hasMatrixPermission(role, "APPROVE_DECISIONS");

  const [items, setItems] = useState<DecisionItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [decisionType, setDecisionType] = useState("");
  const [q, setQ] = useState("");
  const [showExecutive, setShowExecutive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ sort: "score", pageSize: "50" });
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (decisionType) params.set("decisionType", decisionType);
      if (q.trim()) params.set("q", q.trim());
      const [listRes, sumRes] = await Promise.all([
        fetch(`/api/ai-operations/decisions?${params}`, { cache: "no-store" }),
        fetch("/api/ai-operations/decisions/summary", { cache: "no-store" }),
      ]);
      const listJson = await listRes.json();
      const sumJson = await sumRes.json();
      if (!listRes.ok || !listJson.ok) {
        throw new Error(listJson.error ?? "Failed to load decisions");
      }
      setItems(listJson.items ?? []);
      if (sumRes.ok && sumJson.ok) setSummary(sumJson.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status, priority, decisionType, q]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function runEngine() {
    setMessage("");
    setError("");
    const res = await fetch("/api/ai-operations/decisions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Generate failed");
      return;
    }
    setMessage(json.message ?? "Decision engine finished.");
    await load();
  }

  return (
    <MatrixShell title="Decision Engine" activePath="/ai-operations/decisions">
      <MatrixAuthGuard requiredPermissions={["VIEW_DECISION_CENTER"]}>
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              AI Operations
            </p>
            <h1 className="text-2xl font-semibold text-slate-100">
              Decision Engine
            </h1>
            <p className="max-w-3xl text-sm text-slate-400">
              Ranked recommendations from fleet, service, PM, predictive, and
              inventory signals. Review and approve before any high-impact
              change. Sample explanations work without a paid AI provider.
            </p>
          </header>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/ai-operations"
              className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              AI Operations
            </Link>
            <Link
              href="/ai-operations/predictive-maintenance"
              className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Predictive Maintenance
            </Link>
            <Link
              href="/ai-operations/automations"
              className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Automations
            </Link>
            {canRun ? (
              <MatrixButton type="button" onClick={() => void runEngine()}>
                Refresh recommendations
              </MatrixButton>
            ) : null}
            <MatrixButton
              type="button"
              variant="secondary"
              onClick={() => setShowExecutive((v) => !v)}
            >
              {showExecutive ? "Hide executive view" : "Show executive view"}
            </MatrixButton>
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {message}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MatrixStatCard
              label="Critical"
              value={String(summary?.critical ?? 0)}
            />
            <MatrixStatCard
              label="Awaiting review"
              value={String(summary?.awaitingReview ?? 0)}
            />
            <MatrixStatCard
              label="Approved / in progress"
              value={String(summary?.approvedInProgress ?? 0)}
            />
            <MatrixStatCard
              label="Downtime avoided (min)"
              value={String(summary?.estimatedDowntimeAvoidedMinutes ?? 0)}
            />
            <MatrixStatCard
              label="Cost avoided"
              value={
                summary?.costsHidden
                  ? "Hidden"
                  : `$${summary?.estimatedCostAvoided ?? 0}`
              }
            />
          </div>

          {showExecutive && summary ? (
            <MatrixCard className="space-y-4 p-4">
              <div>
                <h2 className="text-lg font-medium text-slate-100">
                  Executive summary
                </h2>
                <p className="text-sm text-slate-400">
                  Top risks and outcomes from real recommendation history — not
                  fabricated analytics.
                </p>
              </div>
              {summary.empty ? (
                <p className="text-sm text-slate-400">
                  No decisions yet. Refresh recommendations to populate this
                  view.
                </p>
              ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-300">
                      Fleet risk by customer/site
                    </h3>
                    <ul className="space-y-1 text-sm text-slate-400">
                      {summary.fleetRisk.length === 0 ? (
                        <li>No open decisions with customer/site tags.</li>
                      ) : (
                        summary.fleetRisk.map((f) => (
                          <li key={f.name}>
                            {f.name}: avg risk {f.avgRisk} ({f.decisions})
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-300">
                      Highest machine risk
                    </h3>
                    <ul className="space-y-1 text-sm text-slate-400">
                      {summary.topMachines.length === 0 ? (
                        <li>No machine-linked open decisions.</li>
                      ) : (
                        summary.topMachines.map((m) => (
                          <li key={m.decisionId}>
                            <Link
                              href={`/ai-operations/decisions/${m.decisionId}`}
                              className="text-cyan-300 hover:underline"
                            >
                              {m.machineId}
                            </Link>{" "}
                            — score {m.overallDecisionScore}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-300">
                      Outcomes
                    </h3>
                    <p className="text-sm text-slate-400">
                      Acceptance rate:{" "}
                      {summary.acceptanceRate == null
                        ? "No completed/rejected outcomes yet"
                        : `${summary.acceptanceRate}%`}
                    </p>
                    <p className="text-sm text-slate-400">
                      Predicted open downtime exposure:{" "}
                      {summary.predictedDowntimeMinutes} min
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Completed over time:{" "}
                      {summary.completedSeries.length === 0
                        ? "none yet"
                        : summary.completedSeries
                            .slice(-5)
                            .map((s) => `${s.date}:${s.count}`)
                            .join(", ")}
                    </p>
                  </div>
                </div>
              )}
            </MatrixCard>
          ) : null}

          <MatrixCard className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <input
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                placeholder="Search title, machine, customer…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  "NEW",
                  "REVIEW_REQUIRED",
                  "APPROVED",
                  "REJECTED",
                  "DEFERRED",
                  "ASSIGNED",
                  "IN_PROGRESS",
                  "COMPLETED",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">All priorities</option>
                {["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"].map(
                  (p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ),
                )}
              </select>
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value)}
              >
                <option value="">All types</option>
                {[
                  "PREDICTIVE_MAINTENANCE",
                  "SLA_RISK",
                  "REPEAT_FAILURE",
                  "PM_SCHEDULING",
                  "PARTS_SHORTAGE",
                  "REORDER_RECOMMENDATION",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                No recommendations match these filters.
                {canRun
                  ? " Try Refresh recommendations to generate from current Matrix data."
                  : ""}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="px-2 py-2 font-medium">Priority</th>
                      <th className="px-2 py-2 font-medium">Recommendation</th>
                      <th className="px-2 py-2 font-medium">Score</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-t border-slate-800 text-slate-200"
                      >
                        <td className="px-2 py-3 align-top">
                          <span
                            className={`inline-block rounded border px-2 py-0.5 text-xs ${badgeClass(item.priority)}`}
                          >
                            {item.priority}
                          </span>
                          {item.highImpact ? (
                            <div className="mt-1 text-[10px] uppercase text-amber-300">
                              Needs approval
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-3 align-top">
                          <Link
                            href={`/ai-operations/decisions/${item.id}`}
                            className="font-medium text-cyan-300 hover:underline"
                          >
                            {item.title}
                          </Link>
                          <p className="mt-1 max-w-md text-xs text-slate-400">
                            {item.summary}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.decisionType}
                            {item.machineId ? ` · ${item.machineId}` : ""}
                            {item.customerId ? ` · ${item.customerId}` : ""}
                          </p>
                        </td>
                        <td className="px-2 py-3 align-top">
                          {Math.round(item.overallDecisionScore)}
                          <div className="text-xs text-slate-500">
                            conf {Math.round(item.confidenceScore)}%
                          </div>
                        </td>
                        <td className="px-2 py-3 align-top">{item.status}</td>
                        <td className="px-2 py-3 align-top text-xs text-slate-300">
                          {item.recommendedAction}
                          {canApprove ? (
                            <div className="mt-2">
                              <Link
                                href={`/ai-operations/decisions/${item.id}`}
                                className="text-cyan-300 hover:underline"
                              >
                                Review
                              </Link>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </MatrixCard>
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
