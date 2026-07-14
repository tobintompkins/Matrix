/**
 * Patch 49B — limited bulk administrative actions.
 */

import { BULK_MAX_BATCH_SIZE, type AdminRecordType, type BulkAdminAction } from "./types";
import { archiveServiceCall, softDeleteServiceCall } from "./service-calls";
import { archiveCustomer } from "./customers";
import { archiveMachine } from "./machines";

export type BulkAdminResult = {
  action: BulkAdminAction;
  requested: number;
  succeeded: number;
  failed: number;
  results: Array<{
    recordId: string;
    ok: boolean;
    error?: string;
  }>;
};

export function performBulkAdminAction(input: {
  action: BulkAdminAction;
  recordType: AdminRecordType;
  recordIds: string[];
  reason: string;
  actor: {
    userId: string;
    displayName: string;
    organizationId?: string;
    canEditCompleted?: boolean;
  };
}): BulkAdminResult | { ok: false; error: string } {
  if (input.recordIds.length === 0) {
    return { ok: false, error: "Select at least one record." };
  }
  if (input.recordIds.length > BULK_MAX_BATCH_SIZE) {
    return {
      ok: false,
      error: `Bulk actions are limited to ${BULK_MAX_BATCH_SIZE} records.`,
    };
  }
  if (input.action === "SOFT_DELETE" && input.reason.trim().length < 3) {
    return { ok: false, error: "A shared reason is required for bulk soft delete." };
  }
  if (input.reason.trim().length < 3 && input.action !== "EXPORT") {
    return { ok: false, error: "A shared reason is required." };
  }

  const serviceActor = {
    userId: input.actor.userId,
    displayName: input.actor.displayName,
    organizationId: input.actor.organizationId,
    canEditCompleted: Boolean(input.actor.canEditCompleted),
  };

  // Bulk permanent deletion is intentionally unavailable.
  const results: BulkAdminResult["results"] = [];

  for (const recordId of input.recordIds) {
    try {
      if (input.action === "EXPORT") {
        results.push({ recordId, ok: true });
        continue;
      }

      if (input.recordType === "SERVICE_CALL") {
        if (input.action === "ARCHIVE") {
          const r = archiveServiceCall(recordId, serviceActor, input.reason);
          results.push({
            recordId,
            ok: r.ok,
            error: r.ok ? undefined : r.error,
          });
        } else if (input.action === "SOFT_DELETE") {
          const r = softDeleteServiceCall(recordId, serviceActor, {
            reason: "DATA_CLEANUP",
            notes: input.reason,
            confirmPhrase: `DELETE ${recordId}`,
          });
          // Bulk soft-delete requires per-record confirm phrase = work order;
          // fail closed with clear message when phrase mismatch.
          results.push({
            recordId,
            ok: r.ok,
            error: r.ok
              ? undefined
              : r.error.includes("Type DELETE")
                ? "Bulk soft delete requires per-record confirmation; use single-record delete for service calls."
                : r.error,
          });
        } else {
          results.push({
            recordId,
            ok: false,
            error: "This bulk action is not supported for service calls.",
          });
        }
        continue;
      }

      if (input.recordType === "CUSTOMER" && input.action === "ARCHIVE") {
        const r = archiveCustomer(recordId, input.actor, input.reason);
        results.push({
          recordId,
          ok: r.ok,
          error: r.ok ? undefined : r.error,
        });
        continue;
      }

      if (input.recordType === "MACHINE" && input.action === "ARCHIVE") {
        const r = archiveMachine(recordId, input.actor, input.reason);
        results.push({
          recordId,
          ok: r.ok,
          error: r.ok ? undefined : r.error,
        });
        continue;
      }

      results.push({
        recordId,
        ok: false,
        error: "Some records in the bulk operation could not be changed.",
      });
    } catch {
      results.push({
        recordId,
        ok: false,
        error: "Some records in the bulk operation could not be changed.",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return {
    action: input.action,
    requested: input.recordIds.length,
    succeeded,
    failed: input.recordIds.length - succeeded,
    results,
  };
}
