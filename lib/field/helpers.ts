import type { WorkOrder } from "@/lib/work-orders/types";
import type {
  CompletionChecklist,
  ConnectivityStatus,
  FieldHomeMetrics,
  FieldStorageStats,
  FieldWorkFilter,
  OfflinePackage,
} from "./types";
import { isWorkOrderDownloaded } from "./packages";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(iso: string | null, day: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export function buildFieldHomeMetrics(input: {
  technicianName: string;
  workOrders: WorkOrder[];
  connectivity: ConnectivityStatus;
  unsyncedChanges: number;
  pmsDueSoon?: number;
}): FieldHomeMetrics {
  const today = startOfDay(new Date());
  const mine = input.workOrders.filter(
    (w) =>
      !input.technicianName ||
      w.assignedTechnician === input.technicianName ||
      w.secondaryTechnician === input.technicianName,
  );

  const open = mine.filter(
    (w) => !["COMPLETED", "CANCELLED", "CLOSED"].includes(w.status),
  );

  return {
    technicianName: input.technicianName,
    dateLabel: today.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    connectivity: input.connectivity,
    scheduledToday: open.filter((w) => isSameDay(w.scheduledStart, today)).length,
    overdue: open.filter((w) => {
      if (!w.scheduledStart) return false;
      return new Date(w.scheduledStart) < today && w.status !== "COMPLETED";
    }).length,
    critical: open.filter((w) => w.priority === "CRITICAL").length,
    waitingForParts: open.filter((w) => w.status === "WAITING_FOR_PARTS").length,
    pmsDueSoon: input.pmsDueSoon ?? 0,
    recentlyCompleted: mine.filter(
      (w) => w.status === "COMPLETED" && isSameDay(w.completedDate, today),
    ).length,
    unsyncedChanges: input.unsyncedChanges,
  };
}

export function filterFieldWorkOrders(
  orders: WorkOrder[],
  filter: FieldWorkFilter | "ALL",
  packages: OfflinePackage[],
  search: string,
  technicianName?: string,
): WorkOrder[] {
  let list = orders;
  if (technicianName) {
    list = list.filter(
      (w) =>
        w.assignedTechnician === technicianName ||
        w.secondaryTechnician === technicianName,
    );
  }

  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  switch (filter) {
    case "TODAY":
      list = list.filter((w) => isSameDay(w.scheduledStart, today));
      break;
    case "TOMORROW":
      list = list.filter((w) => isSameDay(w.scheduledStart, tomorrow));
      break;
    case "THIS_WEEK":
      list = list.filter((w) => {
        if (!w.scheduledStart) return false;
        const d = new Date(w.scheduledStart);
        return d >= today && d < weekEnd;
      });
      break;
    case "OVERDUE":
      list = list.filter(
        (w) =>
          w.scheduledStart &&
          new Date(w.scheduledStart) < today &&
          !["COMPLETED", "CANCELLED", "CLOSED"].includes(w.status),
      );
      break;
    case "CRITICAL":
      list = list.filter((w) => w.priority === "CRITICAL");
      break;
    case "WAITING_FOR_PARTS":
      list = list.filter((w) => w.status === "WAITING_FOR_PARTS");
      break;
    case "COMPLETED":
      list = list.filter((w) => w.status === "COMPLETED" || w.status === "CLOSED");
      break;
    case "DOWNLOADED":
      list = list.filter((w) => isWorkOrderDownloaded(packages, w.id));
      break;
    default:
      break;
  }

  const q = search.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (w) =>
        w.workOrderNumber.toLowerCase().includes(q) ||
        w.customerName.toLowerCase().includes(q) ||
        w.siteName.toLowerCase().includes(q) ||
        (w.printerName ?? "").toLowerCase().includes(q) ||
        (w.printerModel ?? "").toLowerCase().includes(q) ||
        (w.assetTag ?? "").toLowerCase().includes(q),
    );
  }

  return list;
}

export function buildCompletionChecklist(input: {
  workOrder: WorkOrder;
  hasSignatureOrDecline: boolean;
  hasPhotos: boolean;
  maintenanceRequired: boolean;
  maintenanceDone: boolean;
  unsyncedCount: number;
  followUpRecorded: boolean;
}): CompletionChecklist {
  const missing: string[] = [];
  const workDocumented = Boolean(input.workOrder.notes?.trim() || input.workOrder.description);
  const resolutionEntered = Boolean(
    input.workOrder.customerVisibleNotes?.trim() ||
      input.workOrder.notes?.trim() ||
      input.workOrder.status === "COMPLETED",
  );
  const copyCountEntered = input.workOrder.copyCountAtEnd != null;
  const maintenanceChecklistDone =
    !input.maintenanceRequired || input.maintenanceDone;
  const partsRecorded = true; // optional unless parts required
  const laborPresent =
    input.workOrder.actualHours != null ||
    input.workOrder.actualStart != null ||
    ["ON_SITE", "COMPLETED", "TRAVELING"].includes(input.workOrder.status);
  const photosAttached = input.hasPhotos || input.workOrder.attachments.length > 0;
  const signatureOrDecline =
    input.hasSignatureOrDecline || Boolean(input.workOrder.customerSignature);
  const followUpRecorded = input.followUpRecorded;
  const unsyncedVisible = true;

  if (!workDocumented) missing.push("Document work performed");
  if (!resolutionEntered) missing.push("Enter resolution");
  if (!copyCountEntered) missing.push("Enter copy count");
  if (!maintenanceChecklistDone) missing.push("Complete maintenance checklist");
  if (!laborPresent) missing.push("Record labor / session time");
  if (!photosAttached) missing.push("Attach required photos");
  if (!signatureOrDecline) missing.push("Capture signature or decline reason");
  if (!followUpRecorded) missing.push("Record follow-up actions");

  const ready = missing.length === 0;

  return {
    workDocumented,
    resolutionEntered,
    copyCountEntered,
    maintenanceChecklistDone,
    partsRecorded,
    laborPresent,
    photosAttached,
    signatureOrDecline,
    followUpRecorded,
    unsyncedVisible,
    ready,
    missing,
  };
}

export async function getFieldStorageStats(
  estimateBytes: () => Promise<number>,
  pendingOps: number,
  packages: OfflinePackage[],
  pendingAttachmentBytes: number,
  lastSuccessfulSync: string | null,
  lastFullRefresh: string | null,
): Promise<FieldStorageStats> {
  return {
    downloadedPackages: packages.length,
    pendingOps,
    pendingAttachmentBytes,
    estimatedBytes: await estimateBytes(),
    lastSuccessfulSync,
    lastFullRefresh,
  };
}

export function connectivityLabel(status: ConnectivityStatus): string {
  switch (status) {
    case "ONLINE":
      return "Online";
    case "OFFLINE":
      return "Offline";
    case "UNSTABLE":
      return "Connection Unstable";
    case "SYNCHRONIZING":
      return "Synchronizing";
    case "SYNC_FAILED":
      return "Sync Failed";
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compress image data URL roughly by re-encoding quality hint (browser only). */
export async function compressImageDataUrl(
  dataUrl: string,
  quality = 0.7,
  maxWidth = 1600,
): Promise<{ dataUrl: string; sizeBytes: number }> {
  if (typeof document === "undefined") {
    return { dataUrl, sizeBytes: Math.ceil((dataUrl.length * 3) / 4) };
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ dataUrl, sizeBytes: Math.ceil((dataUrl.length * 3) / 4) });
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = canvas.toDataURL("image/jpeg", quality);
      resolve({ dataUrl: out, sizeBytes: Math.ceil((out.length * 3) / 4) });
    };
    img.onerror = () =>
      resolve({ dataUrl, sizeBytes: Math.ceil((dataUrl.length * 3) / 4) });
    img.src = dataUrl;
  });
}

export async function clearOfflineDataSafely(input: {
  clearAll: () => Promise<void>;
  hasUnsynced: boolean;
  confirmClearUnsynced: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  if (input.hasUnsynced && !input.confirmClearUnsynced) {
    return {
      ok: false,
      error:
        "Unsynchronized actions exist. Confirm clearing unsynced data before continuing.",
    };
  }
  await input.clearAll();
  return { ok: true };
}
