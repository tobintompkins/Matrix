"use client";

import { useCallback, useEffect, useState } from "react";
import type { FieldSyncProcessRun } from "@/lib/field/field-sync-process-audit";

export default function FieldSyncProcessHistoryCard() {
  const [runs, setRuns] = useState<FieldSyncProcessRun[]>([]);
  const [notice, setNotice] = useState("Loading processor history…");

  const fetchRuns = useCallback(async (): Promise<FieldSyncProcessRun[]> => {
    const response = await fetch("/api/field/sync/process-runs", { cache: "no-store" });
    const body = (await response.json()) as { runs?: FieldSyncProcessRun[]; error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not load processor history.");
    return body.runs ?? [];
  }, []);

  const load = useCallback(async () => {
    setNotice("Loading processor history…");
    try {
      setRuns(await fetchRuns());
      setNotice("");
    } catch (error) {
      setRuns([]);
      setNotice(error instanceof Error ? error.message : "Could not load processor history.");
    }
  }, [fetchRuns]);

  useEffect(() => {
    let active = true;
    void fetchRuns()
      .then((nextRuns) => {
        if (!active) return;
        setRuns(nextRuns);
        setNotice("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setRuns([]);
        setNotice(error instanceof Error ? error.message : "Could not load processor history.");
      });
    return () => {
      active = false;
    };
  }, [fetchRuns]);

  return (
    <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-100">Receipt Processor History</h2>
          <p className="mt-1 text-xs text-slate-400">Audited manager runs of the existing Field receipt processor.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200"
        >
          Refresh history
        </button>
      </div>

      {notice && <p className="mt-3 text-sm text-slate-300">{notice}</p>}
      {!notice && runs.length === 0 && <p className="mt-3 text-sm text-slate-400">No processor runs have been recorded yet.</p>}
      {runs.length > 0 && (
        <ul className="mt-3 space-y-2 text-xs text-slate-300">
          {runs.map((run) => (
            <li key={run.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <p className="font-semibold text-slate-100">
                {new Date(run.occurredAt).toLocaleString()}
                {run.actorDisplayName && ` · ${run.actorDisplayName}`}
              </p>
              <p className="mt-1 text-slate-400">
                Applied {run.totalApplied} of {run.totalScanned} scanned · Waiting {run.totalWaiting}
                {run.limit !== null && ` · Batch limit ${run.limit}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
