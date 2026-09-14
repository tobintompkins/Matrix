"use client";
import { useFieldIdentity } from "@/app/field/FieldIdentityProvider";
import Link from "next/link";

import { startTransition, useCallback, useEffect, useState } from "react";
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
  retireLegacyOfflineStore,
  type FieldStorageStats,
} from "@/lib/field";
import { canViewOtherTechniciansField } from "@/lib/auth/field-permissions";


export default function FieldSettingsPage() {
  const { userId: TECH_ID, role } = useFieldIdentity();
  const [stats, setStats] = useState<FieldStorageStats | null>(null);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const next = await loadFieldStorageStats(TECH_ID);
    startTransition(() => setStats(next));
  }, [TECH_ID]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
        {canViewOtherTechniciansField(role) && (
          <Link
            href="/field/sync-inbox"
            className="flex min-h-12 items-center justify-center rounded-xl border border-cyan-700/70 bg-cyan-500/10 px-4 font-semibold text-cyan-200"
          >
            Review Server Sync Inbox
          </Link>
        )}
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
        <button
          type="button"
          className="min-h-12 rounded-xl border border-rose-700 font-semibold text-rose-300"
          onClick={() => {
            if (!window.confirm("Remove the old shared Field offline data from this device? It cannot be assigned safely to any user and cannot be restored.")) return;
            void retireLegacyOfflineStore().then(async () => {
              setNotice("Old shared Field data removed from this device.");
              await refresh();
            }).catch((error: unknown) => {
              setNotice(error instanceof Error ? error.message : "Could not remove old shared Field data.");
            });
          }}
        >
          Remove Old Shared Field Data
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Cleanup only affects your signed-in Field data. Old shared Field data is never assigned to a user; remove it only after confirming it is no longer needed.
      </p>
    </FieldShell>
  );
}
