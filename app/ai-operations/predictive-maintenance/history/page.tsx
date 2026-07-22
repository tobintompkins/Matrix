"use client";

import { useEffect, useState } from "react";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixCard } from "../../../components/ui";
import PredictiveNav from "../PredictiveNav";

export default function PredictiveHistoryPage() {
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
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
      setRuns(json.runs);
    })();
  }, []);

  return (
    <MatrixShell title="Prediction History" activePath="/ai-operations/predictive-maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_PREDICTIVE_HISTORY"]}>
        <PredictiveNav />
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
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
