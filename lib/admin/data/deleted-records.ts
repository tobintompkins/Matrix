/**
 * Patch 49B — Deleted Records center aggregation.
 */

import { listAdminServiceCalls } from "./service-calls";
import { listAdminCustomers } from "./customers";
import { listAdminMachines } from "./machines";
import {
  listOperationalStates,
  retentionStatus,
} from "./operational-state";
import { getRelationshipImpact } from "./relationship-impact";
import { PERMANENT_DELETE_ENABLED_BY_DEFAULT } from "./types";
import type { AdminRecordType } from "./types";
import { getDeletionReasonLabel } from "./deletion-reasons";

export type DeletedRecordRow = {
  recordType: AdminRecordType;
  recordId: string;
  identifier: string;
  name: string;
  customer: string | null;
  machine: string | null;
  deletedAt: string;
  deletedBy: string;
  reason: string;
  retentionStatus: string;
  earliestPermanentDeleteDate: string | null;
  canRestore: boolean;
  canPermanentlyDelete: boolean;
  blockers: string[];
};

export function listDeletedRecords(input: {
  recordType?: AdminRecordType | "ALL";
  search?: string;
  page?: number;
  pageSize?: number;
}): {
  items: DeletedRecordRow[];
  total: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const rows: DeletedRecordRow[] = [];

  // Service calls
  if (!input.recordType || input.recordType === "ALL" || input.recordType === "SERVICE_CALL") {
    const calls = listAdminServiceCalls({
      recordState: "DELETED",
      page: 1,
      pageSize: 5000,
    }).items;
    for (const call of calls) {
      const deletedAt = call.deletedAt ?? call.updatedAt;
      const retention = retentionStatus(deletedAt);
      const impact = getRelationshipImpact("SERVICE_CALL", call.id);
      rows.push({
        recordType: "SERVICE_CALL",
        recordId: call.id,
        identifier: call.workOrderNumber,
        name: call.problem.issueTitle || call.workOrderNumber,
        customer: call.machine.customerName,
        machine: call.machine.serialNumber,
        deletedAt,
        deletedBy: call.deletedByUserId ?? "Unknown",
        reason: getDeletionReasonLabel(call.deletionReason ?? "Unknown"),
        retentionStatus: retention.status,
        earliestPermanentDeleteDate: retention.earliestPermanentDeleteDate,
        canRestore: impact.canRestore,
        canPermanentlyDelete: false,
        blockers: [
          ...impact.blockers,
          ...(PERMANENT_DELETE_ENABLED_BY_DEFAULT
            ? []
            : ["Permanent deletion is disabled by default."]),
        ],
      });
    }
  }

  if (!input.recordType || input.recordType === "ALL" || input.recordType === "CUSTOMER") {
    const customers = listAdminCustomers({
      recordState: "DELETED",
      page: 1,
      pageSize: 5000,
    }).items;
    for (const customer of customers) {
      const deletedAt = customer.deletedAt ?? customer.updatedAt;
      const retention = retentionStatus(deletedAt);
      const impact = getRelationshipImpact("CUSTOMER", customer.id);
      rows.push({
        recordType: "CUSTOMER",
        recordId: customer.id,
        identifier: customer.customerNumber,
        name: customer.name,
        customer: customer.name,
        machine: null,
        deletedAt,
        deletedBy: customer.deletedByUserId ?? "Unknown",
        reason: getDeletionReasonLabel(customer.deletionReason ?? "Unknown"),
        retentionStatus: retention.status,
        earliestPermanentDeleteDate: retention.earliestPermanentDeleteDate,
        canRestore: impact.canRestore,
        canPermanentlyDelete: false,
        blockers: impact.blockers,
      });
    }
  }

  if (!input.recordType || input.recordType === "ALL" || input.recordType === "MACHINE") {
    const machines = listAdminMachines({
      recordState: "DELETED",
      page: 1,
      pageSize: 5000,
    }).items;
    for (const machine of machines) {
      const state = listOperationalStates({
        recordType: "MACHINE",
        lifecycle: "DELETED",
      }).find((s) => s.recordId === machine.machineId);
      const deletedAt = state?.deletedAt ?? new Date().toISOString();
      const retention = retentionStatus(deletedAt);
      const impact = getRelationshipImpact("MACHINE", machine.machineId);
      rows.push({
        recordType: "MACHINE",
        recordId: machine.machineId,
        identifier: machine.serialNumber,
        name: machine.nickname,
        customer: machine.customerName,
        machine: machine.serialNumber,
        deletedAt,
        deletedBy: state?.deletedByName ?? state?.deletedByUserId ?? "Unknown",
        reason: getDeletionReasonLabel(String(state?.deletionReason ?? "Unknown")),
        retentionStatus: retention.status,
        earliestPermanentDeleteDate: retention.earliestPermanentDeleteDate,
        canRestore: impact.canRestore,
        canPermanentlyDelete: false,
        blockers: impact.blockers,
      });
    }
  }

  // Overlay-only deleted PM / meters
  for (const type of ["PM_HISTORY", "PM_SCHEDULE", "METER"] as AdminRecordType[]) {
    if (input.recordType && input.recordType !== "ALL" && input.recordType !== type) {
      continue;
    }
    for (const state of listOperationalStates({
      recordType: type,
      lifecycle: "DELETED",
    })) {
      const retention = retentionStatus(state.deletedAt);
      rows.push({
        recordType: type,
        recordId: state.recordId,
        identifier: state.recordId,
        name: state.displayName ?? state.recordId,
        customer: state.customerName ?? null,
        machine: state.machineName ?? null,
        deletedAt: state.deletedAt ?? state.updatedAt,
        deletedBy: state.deletedByName ?? state.deletedByUserId ?? "Unknown",
        reason: getDeletionReasonLabel(String(state.deletionReason ?? "Unknown")),
        retentionStatus: retention.status,
        earliestPermanentDeleteDate: retention.earliestPermanentDeleteDate,
        canRestore: true,
        canPermanentlyDelete: false,
        blockers: [
          "Permanent deletion is disabled by default.",
        ],
      });
    }
  }

  let filtered = rows;
  const q = input.search?.trim().toLowerCase() ?? "";
  if (q) {
    filtered = rows.filter((r) =>
      [r.identifier, r.name, r.customer ?? "", r.machine ?? "", r.reason]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  filtered = [...filtered].sort((a, b) =>
    b.deletedAt.localeCompare(a.deletedAt),
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export function evaluatePermanentDelete(recordType: AdminRecordType): {
  ok: false;
  error: string;
} {
  void recordType;
  return {
    ok: false,
    error:
      "Permanent deletion is disabled by default. Soft-deleted records are retained to preserve service, inventory, financial, warranty, compliance, and audit integrity.",
  };
}
