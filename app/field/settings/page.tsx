"use client";

import { startTransition, useEffect, useState } from "react";
import FieldShell from "../FieldShell";
import {
  clearOfflineDataSafely,
  clearSyncedAttachmentsOnly,
  countPendingOps,
  formatBytes,
  getOfflineStore,
  loadFieldStorageStats,
  markFullRefresh,
  removeCompletedSyncedPackages,
  type FieldStorageStats,
} from "@/lib/field";

const TECH_ID = "tech-toby";

export default function FieldSettingsPage() {
  const [stats, setStats] = useState<FieldStorageStats | null>(null);
  const [notice, setNotice] = useState("");

  async function refresh() {
    const next = await loadFieldStorageStats(TECH_ID);
    startTransition(() => setStats(next));
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <FieldShell title="Field Data">
      {stats && (
        <dl className="mb-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Storage used (est.)</dt>
            <dd>{formatBytes(stats.estimatedBytes)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Downloaded work orders</dt>
            <dd>{stats.downloadedPackages}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Pending sync items</dt>
            <dd>{stats.pendingOps}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Pending attachment size</dt>
            <dd>{formatBytes(stats.pendingAttachmentBytes)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Last successful sync</dt>
            <dd>
              {stats.lastSuccessfulSync
                ? new Date(stats.lastSuccessfulSync).toLocaleString()
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Last full refresh</dt>
            <dd>
              {stats.lastFullRefresh
                ? new Date(stats.lastFullRefresh).toLocaleString()
                : "—"}
            </dd>
          </div>
        </dl>
      )}

      {notice && (
        <p className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </p>
      )}

      <div className="grid gap-3">
        <button
          type="button"
          className="min-h-12 rounded-xl border border-slate-600 font-semibold"
          onClick={() =>
            void markFullRefresh().then(async () => {
              setNotice("Marked full refresh timestamp.");
              await refresh();
            })
          }
        >
          Refresh Downloaded Data Marker
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border border-slate-600 font-semibold"
          onClick={() =>
            void removeCompletedSyncedPackages(TECH_ID, new Set()).then(
              async (n) => {
                setNotice(`Removed ${n} completed offline packages.`);
                await refresh();
              },
            )
          }
        >
          Remove Completed Offline Packages
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border border-slate-600 font-semibold"
          onClick={() =>
            void clearSyncedAttachmentsOnly().then(async (n) => {
              setNotice(`Cleared ${n} synchronized attachments.`);
              await refresh();
            })
          }
        >
          Clear Successfully Synchronized Attachments
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl border border-rose-700 font-semibold text-rose-300"
          onClick={() => {
            void (async () => {
              const pending = await countPendingOps();
              const confirmUnsynced =
                pending === 0 ||
                window.confirm(
                  `WARNING: ${pending} unsynchronized action(s) will be permanently deleted. Continue?`,
                );
              const result = await clearOfflineDataSafely({
                clearAll: () => getOfflineStore().clearAll(),
                hasUnsynced: pending > 0,
                confirmClearUnsynced: confirmUnsynced,
              });
              setNotice(result.ok ? "All offline data cleared." : result.error ?? "Failed");
              await refresh();
            })();
          }}
        >
          Clear All Offline Data
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Automatic cleanup never removes unsynchronized data. Completed and
        synchronized packages / uploaded temps can be pruned manually above.
      </p>
    </FieldShell>
  );
}
