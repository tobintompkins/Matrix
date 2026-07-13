import {
  isOpenServiceCallStatus,
  SERVICE_CALL_STATUS_ORDER,
} from "./workflow";
import type {
  ServiceCall,
  ServiceCallDashboardMetrics,
  ServiceCallFilterState,
  ServiceCallPriority,
  ServiceCallSortKey,
  ServiceCallStatus,
  ServiceCallType,
} from "./types";

type MatrixStatusVariant =
  | "active"
  | "warning"
  | "error"
  | "completed"
  | "waiting-parts"
  | "offline";

export function getServiceCallStatusLabel(status: ServiceCallStatus): string {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function getServiceCallPriorityLabel(
  priority: ServiceCallPriority,
): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

export function getServiceCallTypeLabel(type: ServiceCallType): string {
  return type
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function getServiceCallStatusBadgeVariant(
  status: ServiceCallStatus,
): MatrixStatusVariant {
  switch (status) {
    case "NEW":
    case "UNASSIGNED":
    case "ASSIGNED":
    case "ACCEPTED":
      return "active";
    case "EN_ROUTE":
    case "ON_SITE":
    case "DIAGNOSING":
    case "ESCALATED":
      return "warning";
    case "WAITING_FOR_PARTS":
    case "WAITING_FOR_CUSTOMER":
      return "waiting-parts";
    case "RESOLVED":
    case "CLOSED":
      return "completed";
    case "CANCELLED":
      return "offline";
    default:
      return "offline";
  }
}

export function getServiceCallPriorityBadgeVariant(
  priority: ServiceCallPriority,
): MatrixStatusVariant {
  switch (priority) {
    case "EMERGENCY":
    case "URGENT":
    case "CRITICAL":
      return "error";
    case "HIGH":
      return "warning";
    case "NORMAL":
      return "active";
    case "LOW":
      return "offline";
    default:
      return "offline";
  }
}

export function getServiceCallPriorityBadgeClassName(
  priority: ServiceCallPriority,
): string | undefined {
  if (priority === "EMERGENCY" || priority === "CRITICAL") {
    return "bg-rose-600/25 text-rose-100 ring-2 ring-rose-500/60";
  }
  if (priority === "URGENT") {
    return "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40";
  }
  return undefined;
}

const PRIORITY_RANK: Record<ServiceCallPriority, number> = {
  EMERGENCY: 5,
  CRITICAL: 5,
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

function startOfTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIsoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function computeServiceCallMetrics(
  calls: ServiceCall[],
): ServiceCallDashboardMetrics {
  const today = startOfTodayIsoDate();
  const weekStart = daysAgoIsoDate(7);

  let totalOpen = 0;
  let newCalls = 0;
  let unassigned = 0;
  let assigned = 0;
  let emergency = 0;
  let waitingForParts = 0;
  let dueToday = 0;
  let overdue = 0;
  let closedThisWeek = 0;

  for (const call of calls) {
    if (call.isDraft) continue;

    if (isOpenServiceCallStatus(call.status)) {
      totalOpen += 1;
      if (call.status === "NEW") newCalls += 1;
      if (call.status === "UNASSIGNED") unassigned += 1;
      if (
        call.status === "ASSIGNED" ||
        call.status === "ACCEPTED" ||
        call.status === "EN_ROUTE" ||
        call.status === "ON_SITE" ||
        call.status === "DIAGNOSING"
      ) {
        assigned += 1;
      }
      if (call.priority === "EMERGENCY" || call.problem.machineCurrentlyDown) {
        emergency += 1;
      }
      if (call.status === "WAITING_FOR_PARTS") waitingForParts += 1;

      const due =
        call.schedule.scheduledStart.slice(0, 10) ||
        call.schedule.requestedServiceDate;
      if (due === today) dueToday += 1;
      if (due && due < today) overdue += 1;
    }

    if (
      call.status === "CLOSED" &&
      call.closedAt &&
      call.closedAt.slice(0, 10) >= weekStart
    ) {
      closedThisWeek += 1;
    }
  }

  return {
    totalOpen,
    newCalls,
    unassigned,
    assigned,
    emergency,
    waitingForParts,
    dueToday,
    overdue,
    closedThisWeek,
  };
}

function matchesSearch(call: ServiceCall, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    call.id,
    call.workOrderNumber,
    call.ticketNumber,
    call.machine.assetTag,
    call.machine.serialNumber,
    call.machine.customerName,
    call.machine.siteName,
    call.problem.issueTitle,
    call.problem.errorCode,
    call.machine.machineId,
    call.machine.printerModel,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function filterServiceCalls(
  calls: ServiceCall[],
  filters: ServiceCallFilterState,
): ServiceCall[] {
  return calls.filter((call) => {
    if (call.isDraft && filters.status === "ALL") {
      // hide drafts from main dashboard unless searching by id
      if (!filters.search.trim()) return false;
    }
    if (!matchesSearch(call, filters.search)) return false;
    if (filters.status !== "ALL" && call.status !== filters.status) return false;
    if (filters.priority !== "ALL" && call.priority !== filters.priority)
      return false;
    if (filters.serviceType !== "ALL" && call.serviceType !== filters.serviceType)
      return false;
    if (
      filters.printerModel &&
      call.machine.printerModel !== filters.printerModel
    )
      return false;
    if (
      filters.technician &&
      call.assignment.technician !== filters.technician
    )
      return false;
    if (filters.customerSite) {
      const siteQ = filters.customerSite.toLowerCase();
      const siteHay = `${call.machine.customerName} ${call.machine.siteName}`.toLowerCase();
      if (!siteHay.includes(siteQ)) return false;
    }
    if (
      filters.organization &&
      call.assignment.organization !== filters.organization &&
      call.machine.organization !== filters.organization
    )
      return false;
    if (filters.dateFrom) {
      const created = call.createdAt.slice(0, 10);
      if (created < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const created = call.createdAt.slice(0, 10);
      if (created > filters.dateTo) return false;
    }
    return true;
  });
}

export function sortServiceCalls(
  calls: ServiceCall[],
  sort: ServiceCallSortKey,
): ServiceCall[] {
  const sorted = [...calls];
  sorted.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      case "priority":
        return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      case "scheduled": {
        const as =
          a.schedule.scheduledStart || a.schedule.requestedServiceDate || "";
        const bs =
          b.schedule.scheduledStart || b.schedule.requestedServiceDate || "";
        return as.localeCompare(bs);
      }
      case "customer":
        return a.machine.customerName.localeCompare(b.machine.customerName);
      case "technician":
        return a.assignment.technician.localeCompare(b.assignment.technician);
      case "status":
        return (
          SERVICE_CALL_STATUS_ORDER.indexOf(a.status) -
          SERVICE_CALL_STATUS_ORDER.indexOf(b.status)
        );
      case "newest":
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
  return sorted;
}

export function defaultServiceCallFilters(): ServiceCallFilterState {
  return {
    search: "",
    status: "ALL",
    priority: "ALL",
    serviceType: "ALL",
    printerModel: "",
    technician: "",
    customerSite: "",
    organization: "",
    dateFrom: "",
    dateTo: "",
    sort: "newest",
    view: "table",
  };
}

export function validateResolutionForResolve(call: ServiceCall): string | null {
  const r = call.resolution;
  if (!r.diagnosis.trim()) return "Diagnosis is required before resolving.";
  if (!r.workPerformed.trim())
    return "Work performed is required before resolving.";
  if (!r.resolutionSummary.trim())
    return "Resolution summary is required before resolving.";
  if (!r.finalMachineStatus)
    return "Final machine status is required before resolving.";
  if (!r.technicianName.trim())
    return "Technician name is required before resolving.";
  if (!r.completedAt.trim())
    return "Completion timestamp is required before resolving.";
  return null;
}

export function validateClosure(call: ServiceCall): string | null {
  if (call.status !== "RESOLVED") {
    return "Service call must be RESOLVED before it can be closed.";
  }
  const resolutionError = validateResolutionForResolve(call);
  if (resolutionError) return resolutionError;
  const ack =
    call.customerConfirmation.completionAcknowledged ||
    call.customerConfirmation.managerOverrideClose;
  if (!ack) {
    return "Customer acknowledgement or manager override is required to close.";
  }
  return null;
}

export const SERVICE_CALL_INTEGRATION_PLACEHOLDERS = {
  realDatabasePersistence: "pending",
  dispatchNotifications: "pending",
  emailSmsAlerts: "pending",
  gpsTechnicianRouting: "pending",
  customerPortalUpdates: "pending",
  remoteMonitoringAlerts: "pending",
  slaTracking: "pending",
  laborBilling: "pending",
  customerSignatures: "pending",
  technicianSignatures: "pending",
  photoUploads: "pending",
} as const;
