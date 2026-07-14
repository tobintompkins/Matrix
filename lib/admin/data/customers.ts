/**
 * Patch 49B — Customer administrative operations.
 */

import {
  getCustomer,
  listAssets,
  listContacts,
  listSites,
  updateCustomer,
} from "@/lib/crm/repository";
import type { CrmCustomer } from "@/lib/crm/types";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { validateDeletionReason } from "./deletion-reasons";
import { getRelationshipImpact } from "./relationship-impact";
import {
  archiveOperationalRecord,
  restoreOperationalRecord,
  softDeleteOperationalRecord,
  unarchiveOperationalRecord,
  upsertOperationalState,
} from "./operational-state";
import type { DeletionReasonKey } from "./types";

/** Access CRM store internals via repository patterns already exported. */
import { listCustomers as listCustomersPaged } from "@/lib/crm/repository";

export type AdminCustomerActor = {
  userId: string;
  displayName: string;
  organizationId?: string;
};

function listAllCustomers(): CrmCustomer[] {
  // Large page to get operational set from session CRM store.
  return listCustomersPaged(1, 5000).items;
}

export function listAdminCustomers(input: {
  search?: string;
  recordState?: "ACTIVE" | "ARCHIVED" | "DELETED" | "ALL";
  status?: string;
  page?: number;
  pageSize?: number;
}): { items: CrmCustomer[]; total: number; page: number; pageSize: number } {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const recordState = input.recordState ?? "ACTIVE";
  let customers = listAllCustomers();

  if (recordState === "DELETED") {
    customers = customers.filter(
      (c) => c.recordState === "DELETED" || Boolean(c.deletedAt),
    );
  } else if (recordState === "ARCHIVED") {
    customers = customers.filter(
      (c) => c.recordState === "ARCHIVED" || Boolean(c.archivedAt),
    );
  } else if (recordState === "ACTIVE") {
    customers = customers.filter(
      (c) =>
        (c.recordState ?? "ACTIVE") === "ACTIVE" &&
        !c.deletedAt &&
        !c.archivedAt,
    );
  }

  const q = input.search?.trim().toLowerCase() ?? "";
  if (q) {
    customers = customers.filter((c) =>
      [c.id, c.customerNumber, c.name, c.industry, c.region ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (input.status && input.status !== "ALL") {
    customers = customers.filter((c) => c.status === input.status);
  }

  customers = [...customers].sort((a, b) => a.name.localeCompare(b.name));
  const total = customers.length;
  const start = (page - 1) * pageSize;
  return {
    items: customers.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export function updateCustomerAsAdmin(
  customerId: string,
  patch: Partial<
    Pick<
      CrmCustomer,
      | "name"
      | "customerNumber"
      | "status"
      | "industry"
      | "notes"
      | "billingAddress"
      | "primaryAddress"
      | "website"
      | "region"
      | "accountManager"
      | "preferredBusinessHours"
      | "timeZone"
    >
  > & { expectedVersion?: number },
  actor: AdminCustomerActor,
  reason: string,
): { ok: true; customer: CrmCustomer } | { ok: false; error: string } {
  const customer = getCustomer(customerId);
  if (!customer) return { ok: false, error: "Customer not found." };
  if (customer.recordState === "DELETED" || customer.deletedAt) {
    return {
      ok: false,
      error: "Deleted customers must be restored before editing.",
    };
  }
  if (
    patch.expectedVersion != null &&
    (customer.updatedAtVersion ?? 1) !== patch.expectedVersion
  ) {
    return {
      ok: false,
      error:
        "This record changed after you opened it. Refresh and review the latest information before continuing.",
    };
  }
  if (reason.trim().length < 3) {
    return { ok: false, error: "A reason for change is required." };
  }
  if (
    patch.customerNumber &&
    patch.customerNumber !== customer.customerNumber &&
    reason.trim().length < 3
  ) {
    return {
      ok: false,
      error: "A reason is required when changing the customer number.",
    };
  }

  const result = updateCustomer(customerId, {
    ...patch,
    updatedAtVersion: (customer.updatedAtVersion ?? 1) + 1,
  } as Partial<CrmCustomer>);
  if (!result.ok || !result.customer) {
    return { ok: false, error: result.error ?? "Unable to update customer." };
  }
  void actor;
  return { ok: true, customer: result.customer };
}

export function archiveCustomer(
  customerId: string,
  actor: AdminCustomerActor,
  reason: string,
): { ok: true; customer: CrmCustomer } | { ok: false; error: string } {
  if (reason.trim().length < 3) {
    return { ok: false, error: "An archive reason is required." };
  }
  const customer = getCustomer(customerId);
  if (!customer) return { ok: false, error: "Customer not found." };

  const overlay = archiveOperationalRecord({
    recordType: "CUSTOMER",
    recordId: customerId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: reason.trim(),
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: customer.name,
    customerName: customer.name,
  });
  if (!overlay.ok) return overlay;

  const result = updateCustomer(customerId, {
    recordState: "ARCHIVED",
    archivedAt: overlay.state.archivedAt,
    archivedByUserId: actor.userId,
    archiveReason: reason.trim(),
    status: "INACTIVE",
    updatedAtVersion: (customer.updatedAtVersion ?? 1) + 1,
  } as Partial<CrmCustomer>);
  if (!result.ok || !result.customer) {
    return { ok: false, error: result.error ?? "Unable to archive customer." };
  }
  return { ok: true, customer: result.customer };
}

export function softDeleteCustomer(
  customerId: string,
  actor: AdminCustomerActor,
  input: {
    reason: DeletionReasonKey | string;
    notes?: string | null;
    confirmPhrase: string;
  },
): { ok: true; customer: CrmCustomer } | { ok: false; error: string } {
  const customer = getCustomer(customerId);
  if (!customer) return { ok: false, error: "Customer not found." };

  const reasonCheck = validateDeletionReason(input.reason, input.notes);
  if (!reasonCheck.ok) return reasonCheck;

  const expected = `DELETE ${customer.customerNumber || customer.name}`;
  if (input.confirmPhrase.trim() !== expected) {
    return { ok: false, error: `Type ${expected} to confirm deletion.` };
  }

  const impact = getRelationshipImpact("CUSTOMER", customerId);
  if (!impact.canSoftDelete) {
    return {
      ok: false,
      error:
        impact.blockers[0] ??
        "This customer cannot be deleted because active machines are still assigned.",
    };
  }

  // Empty / test customers: allow when no machines and no open work.
  const assets = listAssets({ customerId, pageSize: 1 }).total;
  const contacts = listContacts(customerId).length;
  void contacts;
  void listSites;

  if (assets > 0) {
    return {
      ok: false,
      error:
        "This customer cannot be deleted because active machines are still assigned.",
    };
  }

  const overlay = softDeleteOperationalRecord({
    recordType: "CUSTOMER",
    recordId: customerId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: input.reason,
    notes: input.notes,
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: customer.name,
    customerName: customer.name,
  });
  if (!overlay.ok) return overlay;

  const result = updateCustomer(customerId, {
    recordState: "DELETED",
    deletedAt: overlay.state.deletedAt,
    deletedByUserId: actor.userId,
    deletionReason: String(input.reason),
    deletionNotes: input.notes ?? null,
    status: "INACTIVE",
    updatedAtVersion: (customer.updatedAtVersion ?? 1) + 1,
  } as Partial<CrmCustomer>);
  if (!result.ok || !result.customer) {
    return { ok: false, error: result.error ?? "Unable to delete customer." };
  }
  return { ok: true, customer: result.customer };
}

export function restoreCustomer(
  customerId: string,
  actor: AdminCustomerActor,
  reason?: string,
): { ok: true; customer: CrmCustomer } | { ok: false; error: string } {
  const customer = getCustomer(customerId);
  if (!customer) return { ok: false, error: "Customer not found." };
  const wasDeleted =
    customer.recordState === "DELETED" || Boolean(customer.deletedAt);

  if (wasDeleted) {
    const overlay = restoreOperationalRecord({
      recordType: "CUSTOMER",
      recordId: customerId,
      actorUserId: actor.userId,
      actorName: actor.displayName,
      reason,
    });
    if (!overlay.ok) return overlay;
  } else if (customer.recordState === "ARCHIVED" || customer.archivedAt) {
    const overlay = unarchiveOperationalRecord({
      recordType: "CUSTOMER",
      recordId: customerId,
      actorUserId: actor.userId,
      actorName: actor.displayName,
    });
    if (!overlay.ok) return overlay;
  } else {
    return {
      ok: false,
      error: "This customer is not archived or deleted.",
    };
  }

  const result = updateCustomer(customerId, {
    recordState: "ACTIVE",
    deletedAt: null,
    deletedByUserId: null,
    deletionReason: null,
    deletionNotes: null,
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    status: "ACTIVE",
    updatedAtVersion: (customer.updatedAtVersion ?? 1) + 1,
  } as Partial<CrmCustomer>);
  if (!result.ok || !result.customer) {
    return { ok: false, error: result.error ?? "Unable to restore customer." };
  }
  upsertOperationalState({
    recordType: "CUSTOMER",
    recordId: customerId,
    lifecycle: "ACTIVE",
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: customer.name,
    updatedAtVersion: 0,
  });
  return { ok: true, customer: result.customer };
}

/** Duplicate review — candidates only; merge deferred. */
export function findCustomerDuplicateCandidates(customerId: string): Array<{
  candidateId: string;
  candidateName: string;
  signals: string[];
  recommendedAction: string;
}> {
  const customer = getCustomer(customerId);
  if (!customer) return [];
  const others = listAllCustomers().filter(
    (c) =>
      c.id !== customerId &&
      c.recordState !== "DELETED" &&
      !c.deletedAt,
  );
  const results: Array<{
    candidateId: string;
    candidateName: string;
    signals: string[];
    recommendedAction: string;
  }> = [];
  for (const other of others) {
    const signals: string[] = [];
    if (
      other.name.trim().toLowerCase() === customer.name.trim().toLowerCase()
    ) {
      signals.push("Same customer name");
    }
    if (
      other.customerNumber &&
      customer.customerNumber &&
      other.customerNumber === customer.customerNumber
    ) {
      signals.push("Same customer number");
    }
    if (
      other.taxId &&
      customer.taxId &&
      other.taxId === customer.taxId
    ) {
      signals.push("Same tax ID");
    }
    if (signals.length > 0) {
      results.push({
        candidateId: other.id,
        candidateName: other.name,
        signals,
        recommendedAction:
          "Review side by side. Automatic merge is deferred until relationship reassignment is verified.",
      });
    }
  }
  return results;
}
