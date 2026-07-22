"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import MatrixShell from "../../../../components/MatrixShell";
import MatrixAuthGuard from "../../../../components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "../../../../components/ui";
import PredictiveNav from "../../PredictiveNav";

export default function PredictiveMachineDetailPage() {
  const params = useParams();
  const machineId = String(params.machineId ?? "");
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canRun = hasMatrixPermission(role, "RUN_PREDICTIVE_MAINTENANCE");
  const canManageRecs = hasMatrixPermission(
    role,
    "MANAGE_PREDICTIVE_RECOMMENDATIONS",
  );

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(
      `/api/ai-operations/predictive-maintenance/machines/${encodeURIComponent(machineId)}`,
      { cache: "no-store" },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Failed to load");
      return;
    }
    setData(json);
  }, [machineId]);

  useEffect(() => {
    if (machineId) void load();
  }, [machineId, load]);

  async function runEval() {
    setMessage("");
    const res = await fetch(
      "/api/ai-operations/predictive-maintenance/evaluate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId }),
      },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Evaluation failed");
      return;
    }
    setMessage(`Evaluated — health ${json.result?.healthScore} (${json.result?.riskLevel})`);
    await load();
  }

  async function recAction(id: string, action: string) {
    await fetch("/api/ai-operations/predictive-maintenance/recommendations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await load();
  }

  const latest = data?.latest as
    | {
        healthScore: number;
        riskLevel: string;
        confidenceScore: number;
        dataQualityScore: number;
        primaryRiskReason: string | null;
        scoringVersion: string;
        generatedAt: string;
        riskFactorsJson: string;
        aiExplanationJson: string | null;
        predictedMaintenanceDate: string | null;
        predictedMaintenanceWindowStart: string | null;
        predictedMaintenanceWindowEnd: string | null;
      }
    | null
    | undefined;

  const recommendations = (data?.recommendations as Array<Record<string, string>>) ?? [];
  const readiness = data?.readiness as
    | { score: number; ready: boolean; missingFields: string[]; warnings: string[] }
    | undefined;

  let factors: Array<{ factor?: string; key?: string; points?: number; scoreImpact?: number; reason?: string; explanation?: string }> = [];
  try {
    factors = latest ? JSON.parse(latest.riskFactorsJson) : [];
  } catch {
    factors = [];
  }

  let aiExplanation: { summary?: string } | null = null;
  try {
    aiExplanation = latest?.aiExplanationJson
      ? JSON.parse(latest.aiExplanationJson)
      : null;
  } catch {
    aiExplanation = null;
  }

  return (
    <MatrixShell
      title={`Predictive · ${machineId}`}
      activePath="/ai-operations/predictive-maintenance"
    >
      <MatrixAuthGuard requiredPermissions={["VIEW_MACHINE_HEALTH"]}>
        <PredictiveNav />
        <p className="mb-3 text-xs text-amber-200/90">
          {(data?.advisory as string) ??
            "Predicted values are advisory."}
        </p>
        {error ? <p className="mb-2 text-sm text-rose-300">{error}</p> : null}
        {message ? <p className="mb-2 text-sm text-cyan-300">{message}</p> : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {canRun ? (
            <MatrixButton type="button" variant="primary" size="md" onClick={() => void runEval()}>
              Run evaluation
            </MatrixButton>
          ) : null}
          <MatrixButton href={`/maintenance/machines/${machineId}`} variant="secondary" size="md">
            Open PM record
          </MatrixButton>
          <MatrixButton href={`/digital-twin/${machineId}`} variant="secondary" size="md">
            Digital twin
          </MatrixButton>
        </div>

        {!data ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="space-y-4">
            <MatrixCard title="Health summary">
              {latest ? (
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Health score (predicted)</dt>
                    <dd className="text-2xl font-semibold text-white">
                      {latest.healthScore}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Risk level</dt>
                    <dd className="text-lg text-amber-200">{latest.riskLevel}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Confidence</dt>
                    <dd className="text-white">{latest.confidenceScore}%</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Data quality</dt>
                    <dd className="text-white">{latest.dataQualityScore}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-500">Primary reason</dt>
                    <dd className="text-slate-300">{latest.primaryRiskReason}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Scoring version</dt>
                    <dd className="text-slate-400">{latest.scoringVersion}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Evaluated</dt>
                    <dd className="text-slate-400">
                      {new Date(latest.generatedAt).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">
                  No snapshot yet. Run an evaluation.
                </p>
              )}
            </MatrixCard>

            <MatrixCard title="Why this score" subtitle="Deterministic factor breakdown">
              {factors.length === 0 ? (
                <p className="text-sm text-slate-500">No risk factors recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-300">
                  {factors.map((f, i) => (
                    <li key={i} className="rounded-lg border border-slate-800 px-3 py-2">
                      <span className="font-medium text-white">
                        {f.key ?? f.factor}
                      </span>
                      <span className="ml-2 text-rose-300">
                        −{f.scoreImpact ?? f.points ?? 0}
                      </span>
                      <p className="text-xs text-slate-400">
                        {f.explanation ?? f.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {aiExplanation?.summary ? (
                <p className="mt-3 rounded-md bg-slate-950/60 p-3 text-xs text-slate-400">
                  AI explanation (advisory): {aiExplanation.summary}
                </p>
              ) : null}
            </MatrixCard>

            <MatrixCard title="Maintenance forecast">
              <p className="text-sm text-slate-300">
                Predicted ideal date:{" "}
                {latest?.predictedMaintenanceDate
                  ? String(latest.predictedMaintenanceDate).slice(0, 10)
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Window:{" "}
                {latest?.predictedMaintenanceWindowStart
                  ? String(latest.predictedMaintenanceWindowStart).slice(0, 10)
                  : "—"}{" "}
                →{" "}
                {latest?.predictedMaintenanceWindowEnd
                  ? String(latest.predictedMaintenanceWindowEnd).slice(0, 10)
                  : "—"}
              </p>
              <p className="mt-2 text-xs text-amber-200/80">
                Official PM due rules in the Maintenance module remain authoritative.
              </p>
            </MatrixCard>

            <MatrixCard title="Data readiness">
              {readiness ? (
                <>
                  <p className="text-sm text-white">
                    Score {readiness.score} ·{" "}
                    {readiness.ready ? "Ready" : "Not ready for high confidence"}
                  </p>
                  {readiness.missingFields.length ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Missing: {readiness.missingFields.join(", ")}
                    </p>
                  ) : null}
                  {readiness.warnings.map((w) => (
                    <p key={w} className="text-xs text-amber-200/80">
                      {w}
                    </p>
                  ))}
                </>
              ) : null}
            </MatrixCard>

            <MatrixCard title="Recommendations">
              {recommendations.length === 0 ? (
                <p className="text-sm text-slate-500">None yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recommendations.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-slate-800 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-white">{r.title}</span>
                        <span className="text-xs text-slate-500">
                          {r.status} · {r.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{r.reason}</p>
                      {r.status === "OPEN" || r.status === "ACKNOWLEDGED" ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <MatrixButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void recAction(r.id, "acknowledge")}
                          >
                            Acknowledge
                          </MatrixButton>
                          {canManageRecs ? (
                            <>
                              <MatrixButton
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => void recAction(r.id, "accept")}
                              >
                                Accept
                              </MatrixButton>
                              <MatrixButton
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => void recAction(r.id, "dismiss")}
                              >
                                Dismiss
                              </MatrixButton>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </MatrixCard>

            <p className="text-xs text-slate-500">
              <Link href="/service-calls" className="text-cyan-400 hover:underline">
                Service calls
              </Link>{" "}
              ·{" "}
              <Link
                href="/ai-operations/predictive-maintenance/data-readiness"
                className="text-cyan-400 hover:underline"
              >
                Fleet data readiness
              </Link>
            </p>
          </div>
        )}
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
