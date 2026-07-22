/**
 * Patch 50C-3 — Permanent deletion preview and guarded purge of eligible records.
 */

import { getRelationshipImpact } from "./relationship-impact";
import {
  getOperationalState,
  purgeOperationalRecord,
  softDeleteOperationalRecord,
} from "./operational-state";
import { getDigitalTwinMachine } from "@/lib/digital-twin";
import { getCustomer } from "@/lib/crm/repository";
import { listServiceCalls } from "@/lib/service-calls";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { AdminRecordType } from "./types";

export type DeletionPreviewResult =
  | "Eligible for Permanent Deletion"
  | "Archive Recommended"
  | "Deletion Blocked"
  | "Requires Approval";

export type PermanentDeletePreview = {
  recordName: string;
  recordType: AdminRecordType;
  recordId: string;
  customer: string | null;
  location: string | null;
  organization: string;
  currentStatus: string;
  linkedRecordCounts: Record<string, number>;
  deletionEligibility: DeletionPreviewResult;
  blockingRelationships: string[];
  recommendedAction: string;
  canPermanentlyDelete: boolean;
};

const HISTORY_BLOCK_MESSAGE =
  "This record cannot be permanently deleted because linked business history exists.\n\nArchive the record instead to remove it from active use while preserving its history.";

function countMachineHistory(machineId: string) {
  const twin = getDigitalTwinMachine(machineId);
  const relatedCalls = listServiceCalls({ includeDeleted: true }).filter(
    (c) =>
      c.machine.machineId === machineId ||
      (twin && c.machine.serialNumber === twin.identity.serialNumber),
  );
  return {
    "Service Calls": relatedCalls.length,
    "PM Records": 0,
    "Meter Readings": 0,
    "Parts Orders": relatedCalls.reduce((n, c) => n + (c.parts?.length ?? 0), 0),
    Approvals: 0,
    "Customer Portal Records": 0,
    Documents: 0,
    Attachments: relatedCalls.reduce(
      (n, c) => n + (c.attachments?.length ?? 0),
      0,
    ),
  };
}

export function previewPermanentDeletion(
  recordType: AdminRecordType,
  recordId: string,
  organizationId = DEFAULT_ORG_ID,
): PermanentDeletePreview {
  const impact = getRelationshipImpact(recordType, recordId);
  const state = getOperationalState(recordType, recordId);

  let recordName = recordId;
  let customer: string | null = null;
  let location: string | null = null;
  const linked: Record<string, number> = {};

  if (recordType === "MACHINE") {
    const twin = getDigitalTwinMachine(recordId);
    recordName = twin?.identity.nickname ?? recordId;
    customer = twin?.location.customerName ?? null;
    location = twin?.location.siteName ?? null;
    Object.assign(linked, countMachineHistory(recordId));
  } else if (recordType === "CUSTOMER") {
    const c = getCustomer(recordId);
    recordName = c?.name ?? recordId;
    customer = c?.name ?? null;
    for (const item of impact.items) linked[item.category] = item.count;
  } else {
    for (const item of impact.items) linked[item.category] = item.count;
    recordName = state?.displayName ?? recordId;
    customer = state?.customerName ?? null;
  }

  const historyTotal = Object.values(linked).reduce((n, v) => n + v, 0);
  const blocking = [...impact.blockers];
  let eligibility: DeletionPreviewResult = "Eligible for Permanent Deletion";
  let recommended = "Proceed with permanent deletion after confirmation.";
  let canPermanentlyDelete = false;

  if (historyTotal > 0) {
    eligibility = "Archive Recommended";
    recommended = HISTORY_BLOCK_MESSAGE;
    blocking.push(HISTORY_BLOCK_MESSAGE);
  } else if (state?.lifecycle !== "DELETED" && state?.lifecycle !== "ARCHIVED") {
    eligibility = "Deletion Blocked";
    recommended =
      "Soft-delete or archive the record first; permanent deletion is only considered for inactive records.";
    blocking.push(recommended);
  } else if (historyTotal === 0 && state?.lifecycle === "DELETED") {
    eligibility = "Eligible for Permanent Deletion";
    canPermanentlyDelete = true;
    recommended =
      "Unused / test record with no protected linked history may be permanently removed.";
  } else if (state?.lifecycle === "ARCHIVED" && historyTotal === 0) {
    eligibility = "Eligible for Permanent Deletion";
    canPermanentlyDelete = true;
    recommended =
      "Archived unused record with no protected history may be permanently removed after confirmation.";
  } else {
    eligibility = "Deletion Blocked";
    recommended = HISTORY_BLOCK_MESSAGE;
  }

  return {
    recordName,
    recordType,
    recordId,
    customer,
    location,
    organization: organizationId,
    currentStatus: state?.lifecycle ?? "ACTIVE",
    linkedRecordCounts: linked,
    deletionEligibility: eligibility,
    blockingRelationships: blocking,
    recommendedAction: recommended,
    canPermanentlyDelete,
  };
}

export function evaluatePermanentDelete(
  recordType: AdminRecordType,
  recordId: string,
): { ok: true; preview: PermanentDeletePreview } | { ok: false; error: string } {
  const preview = previewPermanentDeletion(recordType, recordId);
  if (!preview.canPermanentlyDelete) {
    return {
      ok: false,
      error: preview.recommendedAction.includes("linked business history")
        ? HISTORY_BLOCK_MESSAGE
        : preview.recommendedAction,
    };
  }
  return { ok: true, preview };
}

/**
 * Permanently purge an eligible overlay record. Does not cascade business history.
 * Removes operational-state overlay entry only when preview allows it.
 */
export function permanentlyDeleteAdminRecord(input: {
  recordType: AdminRecordType;
  recordId: string;
  actorUserId: string;
  actorName: string;
  reason: string;
  confirmExact: string;
  organizationId?: string;
}):
  | { ok: true; preview: PermanentDeletePreview }
  | { ok: false; error: string; preview?: PermanentDeletePreview } {
  if (input.reason.trim().length < 3) {
    return { ok: false, error: "A deletion reason is required." };
  }
  const preview = previewPermanentDeletion(
    input.recordType,
    input.recordId,
    input.organizationId ?? DEFAULT_ORG_ID,
  );
  const expected = `DELETE PERMANENTLY ${input.recordId}`;
  if (input.confirmExact.trim() !== expected) {
    return {
      ok: false,
      error: `Type ${expected} to confirm permanent deletion.`,
      preview,
    };
  }
  if (!preview.canPermanentlyDelete) {
    return {
      ok: false,
      error: preview.recommendedAction.includes("linked business history")
        ? HISTORY_BLOCK_MESSAGE
        : preview.recommendedAction,
      preview,
    };
  }

  // Ensure deleted lifecycle first (no cascade of history).
  const state = getOperationalState(input.recordType, input.recordId);
  if (state?.lifecycle !== "DELETED") {
    const soft = softDeleteOperationalRecord({
      recordType: input.recordType,
      recordId: input.recordId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      reason: "TEST_RECORD",
      notes: input.reason,
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      displayName: preview.recordName,
      customerName: preview.customer ?? undefined,
    });
    if (!soft.ok) return { ok: false, error: soft.error, preview };
  }

  const purged = purgeOperationalRecord(input.recordType, input.recordId);
  if (!purged.ok) return { ok: false, error: purged.error, preview };

  return { ok: true, preview };
}
