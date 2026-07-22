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
import PredictiveNav from "./PredictiveNav";

type Overview = {
  fleetHealthScore: number | null;
  machinesEvaluated: number;
  healthy: number;
  watch: number;
  highRisk: number;
  criticalRisk: number;
  unknown: number;
  pmLikelyDueSoon: number;
  lowDataQuality: number;
  openRecommendations: number;
  openAlerts: number;
  highestRisk: Array<{
    id: string;
    machineId: string;
    healthScore: number;
    riskLevel: string;
    primaryRiskReason: string | null;
  }>;
  criticalAlerts: Array<{
    id: string;
    machineId: string;
    title: string;
    severity: string;
  }>;
  pendingRecommendations: Array<{
    id: string;
    machineId: string;
    title: string;
    priority: string;
  }>;
  lastRun: { id: string; status: string; startedAt: string } | null;
};

export default function PredictiveOverviewPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canRun = hasMatrixPermission(role, "RUN_PREDICTIVE_MAINTENANCE");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [advisory, setAdvisory] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        "/api/ai-operations/predictive-maintenance/overview",
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load");
      setOverview(json.overview);
      setAdvisory(json.advisory ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBatch() {
    setMessage("");
    setError("");
    const res = await fetch(
      "/api/ai-operations/predictive-maintenance/evaluate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: true }),
      },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Evaluation failed");
      return;
    }
    setMessage(
      `Batch run ${json.run?.status ?? "completed"} — evaluated ${json.run?.machinesEvaluated ?? 0} machines.`,
    );
    await load();
  }

  return (
    <MatrixShell
      title="Predictive Maintenance"
      activePath="/ai-operations/predictive-maintenance"
    >
      <MatrixAuthGuard requiredPermissions={["VIEW_PREDICTIVE_MAINTENANCE"]}>
        <PredictiveNav />
        <p className="mb-4 text-xs leading-relaxed text-amber-200/90">
          {advisory ||
            "Scores are explainable predictions — not confirmed failures."}
        </p>
        {error ? (
          <p className="mb-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-3 text-sm text-cyan-300" role="status">
            {message}
          </p>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {canRun ? (
            <MatrixButton
              type="button"
              variant="primary"
              size="md"
              onClick={() => void runBatch()}
            >
              Run fleet evaluation
            </MatrixButton>
          ) : null}
          <MatrixButton href="/ai-operations/predictive-maintenance/machines" variant="secondary" size="md">
            Machine health
          </MatrixButton>
          <MatrixButton href="/ai-operations/predictive-maintenance/forecast" variant="secondary" size="md">
            Forecast
          </MatrixButton>
        </div>

        {loading || !overview ? (
          <p className="text-sm text-slate-400">Loading predictive overview…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MatrixStatCard
                label="Fleet health (predicted)"
                value={overview.fleetHealthScore ?? "—"}
                status="neutral"
              />
              <MatrixStatCard
                label="Healthy"
                value={overview.healthy}
                status="ok"
              />
              <MatrixStatCard
                label="Watch"
                value={overview.watch}
                status="watch"
              />
              <MatrixStatCard
                label="High risk"
                value={overview.highRisk}
                status="attention"
              />
              <MatrixStatCard
                label="Critical risk"
                value={overview.criticalRisk}
                status="attention"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MatrixStatCard
                label="PM likely due soon"
                value={overview.pmLikelyDueSoon}
                status="watch"
              />
              <MatrixStatCard
                label="Low data quality"
                value={overview.lowDataQuality}
                status="watch"
              />
              <MatrixStatCard
                label="Open recommendations"
                value={overview.openRecommendations}
                status="neutral"
              />
              <MatrixStatCard
                label="Open alerts"
                value={overview.openAlerts}
                status="attention"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MatrixCard
                title="Highest-risk machines"
                subtitle="Predicted risk — review before acting"
              >
                {overview.highestRisk.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No high/critical machines yet. Run an evaluation.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {overview.highestRisk.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/ai-operations/predictive-maintenance/machines/${m.machineId}`}
                          className="block rounded-lg border border-slate-800 px-3 py-2 hover:border-cyan-500/40"
                        >
                          <span className="font-medium text-white">
                            {m.machineId}
                          </span>
                          <span className="ml-2 text-xs text-rose-300">
                            {m.riskLevel} · {m.healthScore}
                          </span>
                          <p className="mt-1 text-xs text-slate-400">
                            {m.primaryRiskReason}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </MatrixCard>
              <MatrixCard title="Critical alerts" subtitle="Deduped predictive alerts">
                {overview.criticalAlerts.length === 0 ? (
                  <p className="text-sm text-slate-500">No open critical alerts.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-300">
                    {overview.criticalAlerts.map((a) => (
                      <li key={a.id}>
                        <Link
                          href="/ai-operations/predictive-maintenance/alerts"
                          className="text-cyan-300 hover:underline"
                        >
                          {a.title}
                        </Link>
                        <span className="ml-2 text-xs text-slate-500">
                          {a.severity}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </MatrixCard>
            </div>

            <MatrixCard
              title="Recommendations needing action"
              subtitle="Dismissible · audited"
            >
              {overview.pendingRecommendations.length === 0 ? (
                <p className="text-sm text-slate-500">No open recommendations.</p>
              ) : (
                <ul className="space-y-2">
                  {overview.pendingRecommendations.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm"
                    >
                      <div>
                        <Link
                          href={`/ai-operations/predictive-maintenance/machines/${r.machineId}`}
                          className="font-medium text-cyan-300 hover:underline"
                        >
                          {r.machineId}
                        </Link>
                        <span className="ml-2 text-slate-300">{r.title}</span>
                      </div>
                      <span className="text-xs text-amber-200">{r.priority}</span>
                    </li>
                  ))}
                </ul>
              )}
            </MatrixCard>

            {overview.lastRun ? (
              <p className="text-xs text-slate-500">
                Last run: {overview.lastRun.status} ·{" "}
                {new Date(overview.lastRun.startedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        )}
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
