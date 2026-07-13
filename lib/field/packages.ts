import type { WorkOrder } from "@/lib/work-orders/types";
import { getOfflineStore, newEntityId } from "./store";
import { appendFieldAudit } from "./queue";
import type { OfflinePackage, OfflinePackageSnapshot } from "./types";

function nowIso() {
  return new Date().toISOString();
}

export function buildOfflinePackageSnapshot(
  workOrder: WorkOrder,
  extras?: Partial<OfflinePackageSnapshot>,
): OfflinePackageSnapshot {
  return {
    workOrder: { ...workOrder } as unknown as Record<string, unknown>,
    customer: {
      name: workOrder.customerName,
      contact: workOrder.requestedBy,
    },
    site: {
      name: workOrder.siteName,
      address: workOrder.siteAddress,
      region: workOrder.region,
    },
    printer: {
      id: workOrder.printerId,
      name: workOrder.printerName,
      model: workOrder.printerModel,
      assetTag: workOrder.assetTag,
    },
    serviceHistory: extras?.serviceHistory ?? [],
    maintenanceStatus: extras?.maintenanceStatus ?? {
      pmStatus: "UNKNOWN",
      cleaningStatus: "UNKNOWN",
    },
    requiredParts:
      extras?.requiredParts ??
      workOrder.parts.map((p) => ({
        partNumber: p.partNumber,
        description: p.description,
        quantity: p.quantity,
      })),
    truckStock: extras?.truckStock ?? [],
    notes:
      extras?.notes ??
      (workOrder.notes
        ? [{ text: workOrder.notes, at: workOrder.updatedAt }]
        : []),
    diagramRefs: extras?.diagramRefs ?? [],
    documentRefs: extras?.documentRefs ?? [],
    serverRevision: extras?.serverRevision ?? workOrder.updatedAt,
  };
}

export function estimatePackageSize(snapshot: OfflinePackageSnapshot): number {
  return JSON.stringify(snapshot).length;
}

export async function downloadWorkOrderPackage(input: {
  workOrder: WorkOrder;
  technicianId: string;
  extras?: Partial<OfflinePackageSnapshot>;
  ttlHours?: number;
}): Promise<OfflinePackage> {
  const store = getOfflineStore();
  const snapshot = buildOfflinePackageSnapshot(input.workOrder, input.extras);
  const sizeBytes = estimatePackageSize(snapshot);
  const downloadedAt = nowIso();
  const ttl = input.ttlHours ?? 72;
  const expiresAt = new Date(Date.now() + ttl * 3600_000).toISOString();

  const existing = (
    await store.getAll<OfflinePackage & { id: string }>("packages")
  ).find(
    (p) =>
      p.workOrderId === input.workOrder.id &&
      p.technicianId === input.technicianId,
  );

  const pkg: OfflinePackage & { id: string } = {
    id: existing?.id ?? newEntityId("pkg"),
    workOrderId: input.workOrder.id,
    workOrderNumber: input.workOrder.workOrderNumber,
    downloadedAt,
    expiresAt,
    sizeBytes,
    readiness: "READY",
    technicianId: input.technicianId,
    snapshot,
  };

  await store.put("packages", pkg);
  await appendFieldAudit({
    userId: input.technicianId,
    action: "DOWNLOAD_OFFLINE_PACKAGE",
    entityType: "OfflinePackage",
    entityId: pkg.id,
    operationId: null,
    previousValue: null,
    newValue: pkg.workOrderNumber,
    syncStatus: null,
    error: null,
  });
  return pkg;
}

export async function downloadWorkOrders(
  workOrders: WorkOrder[],
  technicianId: string,
): Promise<OfflinePackage[]> {
  const results: OfflinePackage[] = [];
  for (const wo of workOrders) {
    results.push(
      await downloadWorkOrderPackage({ workOrder: wo, technicianId }),
    );
  }
  return results;
}

export async function listOfflinePackages(
  technicianId?: string,
): Promise<OfflinePackage[]> {
  const all = await getOfflineStore().getAll<OfflinePackage>("packages");
  const filtered = technicianId
    ? all.filter((p) => p.technicianId === technicianId)
    : all;
  return filtered.map(markStaleIfExpired);
}

function markStaleIfExpired(pkg: OfflinePackage): OfflinePackage {
  if (pkg.expiresAt && pkg.expiresAt < nowIso()) {
    return { ...pkg, readiness: "STALE" };
  }
  return pkg;
}

export async function getOfflinePackage(
  workOrderId: string,
  technicianId: string,
): Promise<OfflinePackage | null> {
  const pkgs = await listOfflinePackages(technicianId);
  return pkgs.find((p) => p.workOrderId === workOrderId) ?? null;
}

export async function removeOfflinePackage(
  packageId: string,
  userId: string,
  confirm: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!confirm) return { ok: false, error: "Confirmation required." };
  const store = getOfflineStore();
  const pkg = await store.get<OfflinePackage>("packages", packageId);
  if (!pkg) return { ok: false, error: "Package not found." };
  await store.delete("packages", packageId);
  await appendFieldAudit({
    userId,
    action: "REMOVE_OFFLINE_PACKAGE",
    entityType: "OfflinePackage",
    entityId: packageId,
    operationId: null,
    previousValue: pkg.workOrderNumber,
    newValue: null,
    syncStatus: null,
    error: null,
  });
  return { ok: true };
}

export async function refreshOfflinePackage(input: {
  workOrder: WorkOrder;
  technicianId: string;
}): Promise<OfflinePackage> {
  return downloadWorkOrderPackage(input);
}

export function isWorkOrderDownloaded(
  packages: OfflinePackage[],
  workOrderId: string,
): boolean {
  return packages.some(
    (p) => p.workOrderId === workOrderId && p.readiness !== "INCOMPLETE",
  );
}
