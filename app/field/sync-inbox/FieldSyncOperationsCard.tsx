"use client";

import { useCallback, useEffect, useState } from "react";
import type { FieldSyncOperationsHealth } from "@/lib/field/sync-operations-health";

export default function FieldSyncOperationsCard() {
  const [health, setHealth] = useState<FieldSyncOperationsHealth | null>(null);
  const [notice, setNotice] = useState("Loading receipt queue health…");

  const fetchHealth = useCallback(async (): Promise<FieldSyncOperationsHealth> => {
    const response = await fetch("/api/field/sync/health", { cache: "no-store" });
    const body = (await response.json()) as {
      health?: FieldSyncOperationsHealth;
      error?: string;
    };
    if (!response.ok || !body.health) {
      throw new Error(body.error ?? "Could not load receipt queue health.");
    }
    return body.health;
  }, []);

  const load = useCallback(async () => {
    setNotice("Loading receipt queue health…");
    try {
      setHealth(await fetchHealth());
      setNotice("");
    } catch (error) {
      setHealth(null);
      setNotice(error instanceof Error ? error.message : "Could not load receipt queue health.");
    }
  }, [fetchHealth]);

  useEffect(() => {
    let active = true;
    void fetchHealth()
      .then((nextHealth) => {
        if (!active) return;
        setHealth(nextHealth);
        setNotice("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setHealth(null);
        setNotice(
          error instanceof Error ? error.message : "Could not load receipt queue health.",
        );
      });
    return () => {
      active = false;
    };
  }, [fetchHealth]);

  useEffect(() => {
    const refreshAfterProcessing = () => void load();
    window.addEventListener("matrix-field-receipts-processed", refreshAfterProcessing);
    return () => window.removeEventListener("matrix-field-receipts-processed", refreshAfterProcessing);
  }, [load]);

  return (
    <section className="mb-5 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-100">Field Sync Operations</h2>
          <p className="mt-1 text-xs text-slate-400">
            Read-only receipt queue health. Process receipts below; review rejected items before retrying a field workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200"
        >
          Refresh health
        </button>
      </div>

      {notice && <p className="mt-3 text-sm text-slate-300">{notice}</p>}

      {health && (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Metric label="Waiting to process" value={health.received} tone="text-amber-200" />
            <Metric label="Applied" value={health.applied} tone="text-emerald-200" />
            <Metric label="Needs review" value={health.rejected} tone="text-rose-200" />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {health.oldestReceivedAt
              ? `Oldest waiting receipt: ${new Date(health.oldestReceivedAt).toLocaleString()}`
              : "No receipts are waiting to process."}
          </p>
          {health.byType.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950/40 text-xs">
              {health.byType.map((entry) => (
                <li key={entry.type} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-slate-300">
                  <span className="font-semibold">{entry.type.replaceAll("_", " ")}</span>
                  <span>Waiting {entry.received} · Applied {entry.applied} · Review {entry.rejected}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Metric(props: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{props.label}</p>
      <p className={`mt-1 text-xl font-semibold ${props.tone}`}>{props.value}</p>
    </div>
  );
}
