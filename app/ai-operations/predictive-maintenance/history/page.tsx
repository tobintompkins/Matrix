"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import PredictiveNav from "../PredictiveNav";

export default function PredictiveHistoryPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canExport = hasMatrixPermission(role, "EXPORT_PREDICTIVE_DATA");
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        "/api/ai-operations/predictive-maintenance/history",
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setRuns(json.runs ?? []);
      setSnapshots(json.snapshots ?? []);
    })();
  }, []);

  return (
    <MatrixShell title="Prediction History" activePath="/ai-operations/predictive-maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_PREDICTIVE_HISTORY"]}>
        <PredictiveNav />
        {canExport ? (
          <div className="mb-4 flex flex-wrap gap-2">
            <MatrixButton
              href="/api/ai-operations/predictive-maintenance/export?dataset=snapshots&format=csv&days=90"
              variant="secondary"
              size="sm"
            >
              Export snapshots CSV
            </MatrixButton>
            <MatrixButton
              href="/api/ai-operations/predictive-maintenance/export?dataset=alerts&format=csv&days=90"
              variant="secondary"
              size="sm"
            >
              Export alerts CSV
            </MatrixButton>
            <MatrixButton
              href="/api/ai-operations/predictive-maintenance/export?dataset=runs&format=csv&days=90"
              variant="secondary"
              size="sm"
            >
              Export runs CSV
            </MatrixButton>
          </div>
        ) : null}
        <MatrixCard title="Evaluation runs" subtitle="Auditable batch / manual / scheduled runs">
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {runs.length === 0 ? (
            <p className="text-sm text-slate-500">No runs yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {runs.map((r) => (
                <li key={String(r.id)} className="rounded-lg border border-slate-800 px-3 py-2">
                  <span className="text-white">{String(r.runType)}</span>
                  <span className="ml-2 text-cyan-300">{String(r.status)}</span>
                  <span className="ml-2 text-slate-500">
                    {r.startedAt ? new Date(String(r.startedAt)).toLocaleString() : ""}
                  </span>
                  <p className="text-xs text-slate-400">
                    Machines {String(r.machinesEvaluated)} · Recs{" "}
                    {String(r.recommendationsCreated)} · Alerts{" "}
                    {String(r.alertsCreated)} · Errors {String(r.errorsCount)} ·{" "}
                    {String(r.scoringVersion)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
        <MatrixCard
          className="mt-4"
          title="Health snapshots"
          subtitle="Predicted scores are advisory — labeled with scoring version"
        >
          {snapshots.length === 0 ? (
            <p className="text-sm text-slate-500">No snapshots in the selected window.</p>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
              {snapshots.slice(0, 80).map((s) => (
                <li
                  key={String(s.id)}
                  className="rounded-lg border border-slate-800 px-3 py-2"
                >
                  <Link
                    href={`/ai-operations/predictive-maintenance/machines/${encodeURIComponent(String(s.machineId))}`}
                    className="text-cyan-300 hover:underline"
                  >
                    {String(s.machineId)}
                  </Link>
                  <span className="ml-2 tabular-nums text-white">
                    {String(s.healthScore)}
                  </span>
                  <span className="ml-2 text-slate-400">{String(s.riskLevel)}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {s.generatedAt
                      ? new Date(String(s.generatedAt)).toLocaleString()
                      : ""}{" "}
                    · {String(s.scoringVersion ?? "")}
                  </span>
                  <p className="text-xs text-slate-500">
                    {String(s.primaryRiskReason ?? "")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
