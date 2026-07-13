import { countPendingOps, listPendingAttachments } from "./queue";
import { listOfflinePackages } from "./packages";
import { getOfflineStore } from "./store";
import { getFieldStorageStats } from "./helpers";
import type { FieldStorageStats } from "./types";

export async function loadFieldStorageStats(
  technicianId?: string,
): Promise<FieldStorageStats> {
  const store = getOfflineStore();
  const packages = await listOfflinePackages(technicianId);
  const pendingOps = await countPendingOps(technicianId);
  const attachments = await listPendingAttachments();
  const pendingAttachmentBytes = attachments.reduce((s, a) => s + a.sizeBytes, 0);
  const lastSync = await store.get<{ id: string; value: string | null }>(
    "meta",
    "last-successful-sync",
  );
  const lastRefresh = await store.get<{ id: string; value: string | null }>(
    "meta",
    "last-full-refresh",
  );
  return getFieldStorageStats(
    () => store.estimateBytes(),
    pendingOps,
    packages,
    pendingAttachmentBytes,
    lastSync?.value ?? null,
    lastRefresh?.value ?? null,
  );
}

export async function markFullRefresh(at = new Date().toISOString()): Promise<void> {
  await getOfflineStore().put("meta", { id: "last-full-refresh", value: at });
}

export async function clearSyncedAttachmentsOnly(): Promise<number> {
  const store = getOfflineStore();
  const rows = await store.getAll<{ id: string; uploaded: boolean }>("attachments");
  let removed = 0;
  for (const row of rows) {
    if (row.uploaded) {
      await store.delete("attachments", row.id);
      removed += 1;
    }
  }
  return removed;
}

export async function removeCompletedSyncedPackages(
  technicianId: string,
  completedWorkOrderIds: Set<string>,
): Promise<number> {
  const store = getOfflineStore();
  const packages = await listOfflinePackages(technicianId);
  let removed = 0;
  for (const pkg of packages) {
    if (completedWorkOrderIds.has(pkg.workOrderId)) {
      await store.delete("packages", pkg.id);
      removed += 1;
    }
  }
  return removed;
}
