/**
 * Patch 49C — Executive administration dashboard aggregates.
 * Uses existing operational repositories; excludes soft-deleted records.
 */

import { listServiceCalls } from "@/lib/service-calls";
import { computeServiceCallMetrics } from "@/lib/service-calls/helpers";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { listCustomers } from "@/lib/crm/repository";
import { listAdminMachines } from "@/lib/admin/data/machines";
import { listDeletedRecords } from "@/lib/admin/data/deleted-records";
import { getDashboardMetrics, listTransactions } from "@/lib/inventory/enterprise-repository";
import { listOperationalStates } from "@/lib/admin/data/operational-state";

export type ExecutiveDateRange =
  | "TODAY"
  | "LAST_7"
  | "LAST_30"
  | "QTD"
  | "YTD"
  | "CUSTOM";

export type ExecutiveSummary = {
  range: ExecutiveDateRange;
  cards: Array<{ key: string; label: string; value: number; detail?: string }>;
  serviceOperations: {
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    unassigned: number;
    critical: number;
    open: number;
  };
  machines: {
    active: number;
    attention: number;
    retired: number;
  };
  inventory: {
    lowStock: number;
    adjustments: number;
  };
  dataAdmin: {
    deleted: number;
    archived: number;
  };
  notes: string[];
};

function inRange(iso: string, range: ExecutiveDateRange): boolean {
  const d = iso.slice(0, 10);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (range === "TODAY") return d === today;
  if (range === "LAST_7") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return d >= start.toISOString().slice(0, 10);
  }
  if (range === "LAST_30") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return d >= start.toISOString().slice(0, 10);
  }
  if (range === "YTD") return d.startsWith(String(now.getFullYear()));
  if (range === "QTD") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), q, 1).toISOString().slice(0, 10);
    return d >= start;
  }
  return true;
}

export function getExecutiveAdminSummary(
  range: ExecutiveDateRange = "LAST_30",
): ExecutiveSummary {
  const calls = listServiceCalls({ includeDeleted: false, includeArchived: false });
  const metrics = computeServiceCallMetrics(calls);
  const rangeCalls = calls.filter((c) => inRange(c.createdAt, range));
  const completedInRange = calls.filter(
    (c) =>
      (c.status === "CLOSED" || c.status === "RESOLVED") &&
      c.closedAt &&
      inRange(c.closedAt, range),
  );

  const byPriority: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let unassigned = 0;
  let critical = 0;
  for (const call of calls) {
    if (!isOpenServiceCallStatus(call.status)) continue;
    byPriority[call.priority] = (byPriority[call.priority] ?? 0) + 1;
    byStatus[call.status] = (byStatus[call.status] ?? 0) + 1;
    if (!call.assignment.technician?.trim()) unassigned += 1;
    if (call.priority === "EMERGENCY" || call.priority === "URGENT") critical += 1;
  }

  const machines = listAdminMachines({ recordState: "ACTIVE", pageSize: 5000 });
  const retired = listAdminMachines({ recordState: "RETIRED", pageSize: 5000 });
  const attention = machines.items.filter(
    (m) =>
      m.status === "DOWN" ||
      m.status === "SERVICE_REQUIRED" ||
      m.status === "DEGRADED",
  ).length;

  const inv = getDashboardMetrics();
  const adjustments = listTransactions(200).filter(
    (t) => t.type === "ADJUSTMENT" || t.type === "CYCLE_COUNT",
  ).length;

  const deleted = listDeletedRecords({ pageSize: 1 }).total;
  const archived = listOperationalStates({ lifecycle: "ARCHIVED" }).length;
  const customers = listCustomers(1, 1);

  const notes: string[] = [
    "Soft-deleted records are excluded from executive metrics.",
    "PM compliance percentages require live PM dashboard APIs and are not fabricated here.",
    "Matrix Assist usage is available on Usage & Adoption / Matrix Assist administration.",
  ];

  return {
    range,
    cards: [
      { key: "open", label: "Open Service Calls", value: metrics.totalOpen },
      {
        key: "completed",
        label: "Completed Service Calls",
        value: completedInRange.length,
        detail: `In selected range (${rangeCalls.length} created)`,
      },
      { key: "critical", label: "Critical Calls", value: critical },
      { key: "unassigned", label: "Unassigned Calls", value: unassigned },
      {
        key: "machines",
        label: "Active Machines",
        value: machines.total,
      },
      {
        key: "attention",
        label: "Machines Requiring Attention",
        value: attention,
      },
      {
        key: "retired",
        label: "Retired Machines",
        value: retired.total,
      },
      {
        key: "customers",
        label: "Active Customers",
        value: customers.total,
      },
      {
        key: "lowStock",
        label: "Low-Stock Parts",
        value: inv.lowStock ?? 0,
      },
      {
        key: "adjustments",
        label: "Inventory Adjustments",
        value: adjustments,
        detail: "Recent transaction window",
      },
      { key: "deleted", label: "Deleted Records", value: deleted },
      { key: "archived", label: "Archived Records", value: archived },
    ],
    serviceOperations: {
      byPriority,
      byStatus,
      unassigned,
      critical,
      open: metrics.totalOpen,
    },
    machines: {
      active: machines.total,
      attention,
      retired: retired.total,
    },
    inventory: {
      lowStock: inv.lowStock ?? 0,
      adjustments,
    },
    dataAdmin: { deleted, archived },
    notes,
  };
}
