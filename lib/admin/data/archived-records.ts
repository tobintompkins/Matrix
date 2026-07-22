/**
 * Patch 50C-3 — Archived Records Center (aggregates operational overlay archives).
 */

import { listAdminServiceCalls } from "./service-calls";
import { listAdminCustomers } from "./customers";
import { listAdminMachines } from "./machines";
import { listOperationalStates } from "./operational-state";
import { getRelationshipImpact } from "./relationship-impact";
import type { AdminRecordType } from "./types";

export type ArchivedRecordRow = {
  recordType: AdminRecordType;
  recordId: string;
  recordName: string;
  customer: string | null;
  location: string | null;
  archivedBy: string;
  archivedDate: string;
  archiveReason: string;
  linkedHistory: number;
  restoreEligible: boolean;
  restoreBlockers: string[];
};

export function listArchivedRecords(input: {
  recordType?: AdminRecordType | "ALL";
  customer?: string;
  location?: string;
  archivedBy?: string;
  restorableOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}): {
  items: ArchivedRecordRow[];
  total: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const rows: ArchivedRecordRow[] = [];

  const pushFromState = (
    recordType: AdminRecordType,
    recordId: string,
    recordName: string,
    customer: string | null,
    location: string | null,
  ) => {
    const state = listOperationalStates({
      recordType,
      lifecycle: "ARCHIVED",
    }).find((s) => s.recordId === recordId);
    if (!state) return;
    const impact = getRelationshipImpact(recordType, recordId);
    const linkedHistory = impact.items.reduce((n, i) => n + i.count, 0);
    rows.push({
      recordType,
      recordId,
      recordName,
      customer,
      location,
      archivedBy: state.archivedByName ?? state.archivedByUserId ?? "Unknown",
      archivedDate: state.archivedAt ?? state.updatedAt,
      archiveReason: String(state.archiveReason ?? "Not provided"),
      linkedHistory,
      restoreEligible: impact.canRestore,
      restoreBlockers: impact.canRestore ? [] : impact.blockers,
    });
  };

  if (!input.recordType || input.recordType === "ALL" || input.recordType === "SERVICE_CALL") {
    for (const call of listAdminServiceCalls({
      recordState: "ARCHIVED",
      page: 1,
      pageSize: 5000,
    }).items) {
      pushFromState(
        "SERVICE_CALL",
        call.id,
        call.problem.issueTitle || call.workOrderNumber,
        call.machine.customerName,
        (call.machine as { siteName?: string }).siteName ?? null,
      );
    }
  }

  if (!input.recordType || input.recordType === "ALL" || input.recordType === "CUSTOMER") {
    for (const customer of listAdminCustomers({
      recordState: "ARCHIVED",
      page: 1,
      pageSize: 5000,
    }).items) {
      pushFromState(
        "CUSTOMER",
        customer.id,
        customer.name,
        customer.name,
        null,
      );
    }
  }

  if (!input.recordType || input.recordType === "ALL" || input.recordType === "MACHINE") {
    for (const machine of listAdminMachines({
      recordState: "ARCHIVED",
      page: 1,
      pageSize: 5000,
    }).items) {
      pushFromState(
        "MACHINE",
        machine.machineId,
        machine.nickname,
        machine.customerName,
        machine.siteName,
      );
    }
  }

  for (const type of ["PM_HISTORY", "PM_SCHEDULE", "METER", "PART"] as AdminRecordType[]) {
    if (input.recordType && input.recordType !== "ALL" && input.recordType !== type) {
      continue;
    }
    for (const state of listOperationalStates({
      recordType: type,
      lifecycle: "ARCHIVED",
    })) {
      const impact = getRelationshipImpact(type, state.recordId);
      rows.push({
        recordType: type,
        recordId: state.recordId,
        recordName: state.displayName ?? state.recordId,
        customer: state.customerName ?? null,
        location: null,
        archivedBy: state.archivedByName ?? state.archivedByUserId ?? "Unknown",
        archivedDate: state.archivedAt ?? state.updatedAt,
        archiveReason: String(state.archiveReason ?? "Not provided"),
        linkedHistory: impact.items.reduce((n, i) => n + i.count, 0),
        restoreEligible: impact.canRestore,
        restoreBlockers: impact.canRestore ? [] : impact.blockers,
      });
    }
  }

  let filtered = rows;
  const customerQ = input.customer?.trim().toLowerCase();
  if (customerQ) {
    filtered = filtered.filter((r) =>
      (r.customer ?? "").toLowerCase().includes(customerQ),
    );
  }
  const locationQ = input.location?.trim().toLowerCase();
  if (locationQ) {
    filtered = filtered.filter((r) =>
      (r.location ?? "").toLowerCase().includes(locationQ),
    );
  }
  const byQ = input.archivedBy?.trim().toLowerCase();
  if (byQ) {
    filtered = filtered.filter((r) => r.archivedBy.toLowerCase().includes(byQ));
  }
  if (input.restorableOnly) {
    filtered = filtered.filter((r) => r.restoreEligible);
  }
  const q = input.search?.trim().toLowerCase() ?? "";
  if (q) {
    filtered = filtered.filter((r) =>
      [
        r.recordName,
        r.recordId,
        r.customer ?? "",
        r.location ?? "",
        r.archiveReason,
        r.archivedBy,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  filtered = [...filtered].sort((a, b) =>
    b.archivedDate.localeCompare(a.archivedDate),
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
