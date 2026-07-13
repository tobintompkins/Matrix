import type {
  CreateWorkOrderInput,
  PriorityConfig,
  WorkOrder,
  WorkOrderDashboardMetrics,
  WorkOrderFilterState,
  WorkOrderPriority,
  WorkOrderServiceType,
  WorkOrderStatus,
  WorkOrderTimelineEventType,
} from "./types";
import { DEFAULT_PRIORITY_CONFIGS, DEFAULT_SERVICE_TYPE_CONFIGS } from "./types";
import { isOpenWorkOrderStatus } from "./workflow";

const PRIORITY_RANK: Record<WorkOrderPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

export function defaultWorkOrderFilters(
  currentUser = "",
): WorkOrderFilterState {
  return {
    search: "",
    status: "ALL",
    customer: "",
    technician: "",
    serviceType: "",
    priority: "ALL",
    dateFrom: "",
    dateTo: "",
    region: "",
    printerModel: "",
    site: "",
    onlyMine: false,
    currentUser,
    sort: "updated",
    sortDir: "desc",
  };
}

export function getWorkOrderStatusLabel(status: WorkOrderStatus): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function getWorkOrderPriorityLabel(
  priority: WorkOrderPriority,
  configs: PriorityConfig[] = DEFAULT_PRIORITY_CONFIGS,
): string {
  return configs.find((c) => c.priority === priority)?.label ?? priority;
}

export function getWorkOrderServiceTypeLabel(
  code: string,
): string {
  return (
    DEFAULT_SERVICE_TYPE_CONFIGS.find((c) => c.code === code)?.label ?? code
  );
}

export function getWorkOrderTimelineLabel(
  type: WorkOrderTimelineEventType,
): string {
  switch (type) {
    case "CREATED":
      return "Created";
    case "ASSIGNED":
      return "Assigned";
    case "STATUS_CHANGED":
      return "Status Changed";
    case "NOTE_ADDED":
      return "Note Added";
    case "PHOTO_UPLOADED":
      return "Photo Uploaded";
    case "FILE_UPLOADED":
      return "File Uploaded";
    case "SIGNATURE_CAPTURED":
      return "Signature Captured";
    case "PART_ADDED":
      return "Part Added";
    case "LABOR_UPDATED":
      return "Labor Updated";
    case "TRAVEL_UPDATED":
      return "Travel Updated";
    case "COPY_COUNT_RECORDED":
      return "Copy Count Recorded";
    case "COMPLETED":
      return "Completed";
    case "FIELD_CHANGED":
      return "Field Changed";
    default:
      return type;
  }
}

export function statusBadgeVariant(
  status: WorkOrderStatus,
): "active" | "warning" | "error" | "completed" | "waiting-parts" | "offline" {
  switch (status) {
    case "COMPLETED":
    case "CLOSED":
      return "completed";
    case "WAITING_FOR_PARTS":
      return "waiting-parts";
    case "WAITING_FOR_CUSTOMER":
    case "ON_HOLD":
      return "warning";
    case "CANCELLED":
    case "DRAFT":
      return "offline";
    case "TRAVELING":
    case "ON_SITE":
      return "active";
    default:
      return "active";
  }
}

export function priorityBadgeVariant(
  priority: WorkOrderPriority,
): "error" | "warning" | "active" | "offline" {
  switch (priority) {
    case "CRITICAL":
      return "error";
    case "HIGH":
      return "warning";
    case "LOW":
      return "offline";
    default:
      return "active";
  }
}

/**
 * Generate next WO number: WO-YYYY-000001 — never reuse sequences.
 */
export function nextWorkOrderNumber(
  existingNumbers: string[],
  now: Date = new Date(),
): string {
  const year = now.getFullYear();
  const prefix = `WO-${year}-`;
  let max = 0;
  for (const num of existingNumbers) {
    if (!num.startsWith(prefix)) continue;
    const seq = Number(num.slice(prefix.length));
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  const next = max + 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export function filterWorkOrders(
  orders: WorkOrder[],
  filters: WorkOrderFilterState,
): WorkOrder[] {
  const q = filters.search.trim().toLowerCase();
  return orders.filter((wo) => {
    if (q) {
      const hay = [
        wo.workOrderNumber,
        wo.title,
        wo.description,
        wo.customerName,
        wo.siteName,
        wo.assignedTechnician,
        wo.printerName,
        wo.assetTag,
        wo.notes,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.status !== "ALL" && wo.status !== filters.status) return false;
    if (filters.customer && wo.customerName !== filters.customer) return false;
    if (filters.technician && wo.assignedTechnician !== filters.technician) {
      return false;
    }
    if (filters.serviceType && wo.serviceType !== filters.serviceType) {
      return false;
    }
    if (filters.priority !== "ALL" && wo.priority !== filters.priority) {
      return false;
    }
    if (filters.region && wo.region !== filters.region) return false;
    if (filters.printerModel && wo.printerModel !== filters.printerModel) {
      return false;
    }
    if (filters.site && wo.siteName !== filters.site) return false;
    if (
      filters.onlyMine &&
      filters.currentUser &&
      wo.assignedTechnician !== filters.currentUser &&
      wo.secondaryTechnician !== filters.currentUser
    ) {
      return false;
    }
    const day = (wo.scheduledStart || wo.createdAt).slice(0, 10);
    if (filters.dateFrom && day < filters.dateFrom) return false;
    if (filters.dateTo && day > filters.dateTo) return false;
    return true;
  });
}

export function sortWorkOrders(
  orders: WorkOrder[],
  sort: WorkOrderFilterState["sort"],
  dir: "asc" | "desc" = "desc",
): WorkOrder[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...orders].sort((a, b) => {
    switch (sort) {
      case "priority":
        return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * mul;
      case "scheduled":
        return (
          (a.scheduledStart ?? "").localeCompare(b.scheduledStart ?? "") * mul
        );
      case "number":
        return a.workOrderNumber.localeCompare(b.workOrderNumber) * mul;
      case "updated":
      default:
        return a.updatedAt.localeCompare(b.updatedAt) * mul;
    }
  });
}

export function computeWorkOrderMetrics(
  orders: WorkOrder[],
  now: Date = new Date(),
): WorkOrderDashboardMetrics {
  const today = now.toISOString().slice(0, 10);
  const open = orders.filter((o) => isOpenWorkOrderStatus(o.status)).length;
  const scheduledToday = orders.filter(
    (o) =>
      o.scheduledStart?.slice(0, 10) === today &&
      isOpenWorkOrderStatus(o.status),
  ).length;
  const overdue = orders.filter((o) => {
    if (!isOpenWorkOrderStatus(o.status) || !o.scheduledEnd) return false;
    return o.scheduledEnd.slice(0, 10) < today;
  }).length;
  const waitingForParts = orders.filter(
    (o) => o.status === "WAITING_FOR_PARTS",
  ).length;
  const completedToday = orders.filter(
    (o) =>
      (o.completedDate ?? o.actualEnd ?? "").slice(0, 10) === today &&
      (o.status === "COMPLETED" || o.status === "CLOSED"),
  ).length;
  const completedWithHours = orders.filter(
    (o) =>
      (o.status === "COMPLETED" || o.status === "CLOSED") &&
      o.actualHours != null,
  );
  const averageCompletionHours =
    completedWithHours.length === 0
      ? null
      : Math.round(
          (completedWithHours.reduce((s, o) => s + (o.actualHours ?? 0), 0) /
            completedWithHours.length) *
            10,
        ) / 10;
  const critical = orders.filter(
    (o) => o.priority === "CRITICAL" && isOpenWorkOrderStatus(o.status),
  ).length;

  return {
    open,
    scheduledToday,
    overdue,
    waitingForParts,
    completedToday,
    averageCompletionHours,
    critical,
  };
}

export function validateCreateWorkOrderInput(
  input: CreateWorkOrderInput,
): { ok: true } | { ok: false; error: string } {
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (!input.customerName.trim()) {
    return { ok: false, error: "Customer is required." };
  }
  if (!input.siteName.trim()) return { ok: false, error: "Site is required." };
  if (!input.serviceType) {
    return { ok: false, error: "Service type is required." };
  }
  return { ok: true };
}

export function laborCostFrom(
  hours: number | null,
  rate: number | null,
): number | null {
  if (hours == null || rate == null) return null;
  return Math.round(hours * rate * 100) / 100;
}

export type { WorkOrderServiceType };
