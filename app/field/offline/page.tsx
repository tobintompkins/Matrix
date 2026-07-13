"use client";

import { startTransition, useEffect, useState } from "react";
import FieldShell from "../FieldShell";
import {
  applyConflictResolution,
  cancelOperation,
  listConflicts,
  listOperations,
  retryOperation,
  synchronizeQueue,
  type OfflineOperation,
  type SyncConflict,
} from "@/lib/field";

export default function FieldOfflineQueuePage() {
  const [ops, setOps] = useState<OfflineOperation[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<OfflineOperation | null>(null);

  async function refresh() {
    const [nextOps, nextConflicts] = await Promise.all([
      listOperations(),
      listConflicts(),
    ]);
    startTransition(() => {
      setOps(nextOps);
      setConflicts(nextConflicts);
    });
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function retryAll() {
    const attempt = await synchronizeQueue();
    setNotice(
      `Sync ${attempt.status}: ${attempt.succeeded} succeeded, ${attempt.failed} failed, ${attempt.conflicts} conflicts`,
    );
    await refresh();
  }

  return (
    <FieldShell title="Offline Queue">
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void retryAll()}
          className="min-h-12 flex-1 rounded-xl bg-cyan-500 px-4 font-semibold text-slate-950"
        >
          Retry All / Synchronize
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          className="min-h-12 rounded-xl border border-slate-600 px-4 font-semibold"
        >
          Refresh
        </button>
      </div>

      {notice && (
        <p className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </p>
      )}

      {conflicts.filter((c) => c.status === "OPEN").length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-amber-300">
            Conflicts
          </h2>
          <ul className="space-y-3">
            {conflicts
              .filter((c) => c.status === "OPEN")
              .map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
                >
                  <p className="font-semibold text-white">
                    {c.entityType} · {c.field}
                  </p>
                  <p className="mt-1 text-slate-300">Offline: {c.offlineValue}</p>
                  <p className="text-slate-300">Server: {c.serverValue}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(
                      [
                        "KEEP_SERVER",
                        "SUBMIT_OFFLINE",
                        "MERGE_NOTES",
                        "SAVE_AS_HISTORY",
                        "ASK_MANAGER",
                      ] as const
                    ).map((r) => (
                      <button
                        key={r}
                        type="button"
                        className="min-h-10 rounded-lg border border-slate-600 px-2 text-xs font-semibold"
                        onClick={() =>
                          void applyConflictResolution({
                            conflict: c,
                            resolution: r,
                            resolvedBy: "Toby Tompkins",
                            role: "SERVICE_MANAGER",
                          }).then(async (res) => {
                            setNotice(
                              res.ok ? `Resolved with ${r}` : res.error ?? "Failed",
                            );
                            await refresh();
                          })
                        }
                      >
                        {r.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">
        Pending actions
      </h2>
      <ul className="space-y-3">
        {ops.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">
            Queue is empty.
          </li>
        )}
        {ops.map((op) => (
          <li
            key={op.operationId}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-white">
                  {op.type.replaceAll("_", " ")}
                </p>
                <p className="text-xs text-slate-500">
                  {op.workOrderId ?? op.printerId ?? "—"} ·{" "}
                  {new Date(op.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold">
                {op.status}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold"
                onClick={() => setSelected(op)}
              >
                View Details
              </button>
              {op.status !== "SYNCHRONIZED" && op.status !== "CANCELLED" && (
                <>
                  <button
                    type="button"
                    className="min-h-10 rounded-lg border border-cyan-600 px-3 text-xs font-semibold text-cyan-300"
                    onClick={() =>
                      void retryOperation(op.operationId).then(async (r) => {
                        setNotice(r.ok ? "Retry succeeded" : r.error ?? "Retry failed");
                        await refresh();
                      })
                    }
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="min-h-10 rounded-lg border border-rose-700 px-3 text-xs font-semibold text-rose-300"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Cancel this unsynchronized action? This cannot be undone.",
                        )
                      ) {
                        return;
                      }
                      void cancelOperation(op.operationId, true).then(async (r) => {
                        setNotice(r.ok ? "Cancelled" : r.error ?? "Failed");
                        await refresh();
                      });
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h3 className="text-lg font-bold">{selected.type}</h3>
            <pre className="mt-4 overflow-auto rounded-lg bg-slate-950 p-3 text-xs">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
            <button
              type="button"
              className="mt-4 min-h-12 w-full rounded-xl border border-slate-600 font-semibold"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </FieldShell>
  );
}
