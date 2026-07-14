/**
 * Patch 49B — relationship-impact preview for archive/delete/restore.
 */

import { listServiceCalls, getServiceCall } from "@/lib/service-calls";
import { getCustomer, listAssets, listContacts, listSites } from "@/lib/crm/repository";
import { getDigitalTwinMachine } from "@/lib/digital-twin";
import { getCatalogPart, listTransactions } from "@/lib/inventory/enterprise-repository";
import { getOperationalState } from "./operational-state";
import { PERMANENT_DELETE_ENABLED_BY_DEFAULT } from "./types";
import type {
  AdminRecordType,
  RelationshipImpact,
  RelationshipImpactItem,
} from "./types";

function isActiveCall(call: { deletedAt?: string | null; recordState?: string }) {
  return call.recordState !== "DELETED" && !call.deletedAt;
}

export function getRelationshipImpact(
  recordType: AdminRecordType,
  recordId: string,
): RelationshipImpact {
  const state = getOperationalState(recordType, recordId);
  const items: RelationshipImpactItem[] = [];
  const blockers: string[] = [];
  let canArchive = true;
  let canSoftDelete = true;
  let canRestore =
    state?.lifecycle === "DELETED" || state?.lifecycle === "ARCHIVED";
  let canPermanentlyDelete = false;

  if (recordType === "SERVICE_CALL") {
    const call = getServiceCall(recordId);
    if (!call) {
      return emptyImpact(recordType, recordId, ["Service call not found."]);
    }
    items.push(
      { category: "Parts Usage", count: call.parts?.length ?? 0 },
      { category: "Attachments", count: call.attachments?.length ?? 0 },
      {
        category: "Notes",
        count: call.notes?.length ?? 0,
      },
      {
        category: "Activity / Audit Events",
        count: call.activity?.length ?? 0,
      },
      {
        category: "Time / Travel",
        count: call.schedule ? 1 : 0,
      },
    );
    if (call.status === "CLOSED" || call.status === "RESOLVED") {
      items.push({
        category: "Completed Historical Work",
        count: 1,
        detail: "Completed service calls require elevated permission to edit.",
      });
    }
    canRestore =
      call.recordState === "DELETED" ||
      call.recordState === "ARCHIVED" ||
      Boolean(call.deletedAt) ||
      Boolean(call.archivedAt);
  }

  if (recordType === "CUSTOMER") {
    const customer = getCustomer(recordId);
    if (!customer) {
      return emptyImpact(recordType, recordId, ["Customer not found."]);
    }
    const assets = listAssets({ customerId: recordId, pageSize: 500 }).items;
    const contacts = listContacts(recordId);
    const sites = listSites(recordId, 1, 500).items;
    const relatedCalls = listServiceCalls({ includeDeleted: true }).filter(
      (c) =>
        c.machine.customerName === customer.name ||
        (c as { customerId?: string }).customerId === recordId,
    );
    const openWork = relatedCalls.filter(
      (c) =>
        isActiveCall(c) &&
        c.status !== "CLOSED" &&
        c.status !== "CANCELLED" &&
        c.status !== "RESOLVED",
    );
    items.push(
      { category: "Machines", count: assets.length, blocking: assets.length > 0 },
      { category: "Service Calls", count: relatedCalls.length },
      { category: "Open Work", count: openWork.length, blocking: openWork.length > 0 },
      { category: "Contacts", count: contacts.length },
      { category: "Locations", count: sites.length },
      { category: "Attachments", count: 0 },
      { category: "PM Records", count: 0 },
      { category: "Parts Orders", count: 0 },
    );
    if (openWork.length > 0) {
      canSoftDelete = false;
      blockers.push(
        "This customer cannot be deleted because active machines or open work are still assigned.",
      );
    }
    if (assets.length > 0 && openWork.length === 0) {
      canSoftDelete = false;
      blockers.push(
        "Prefer archive over deletion while machines remain assigned. Soft delete is blocked for customers with machine history unless empty/test.",
      );
    }
    canRestore =
      customer.recordState === "DELETED" ||
      customer.recordState === "ARCHIVED" ||
      Boolean(customer.deletedAt) ||
      Boolean(customer.archivedAt);
  }

  if (recordType === "MACHINE") {
    const twin = getDigitalTwinMachine(recordId);
    if (!twin) {
      return emptyImpact(recordType, recordId, ["Machine not found."]);
    }
    const relatedCalls = listServiceCalls({ includeDeleted: true }).filter(
      (c) =>
        c.machine.machineId === recordId ||
        c.machine.serialNumber === twin.identity.serialNumber,
    );
    const openCalls = relatedCalls.filter(
      (c) =>
        isActiveCall(c) &&
        c.status !== "CLOSED" &&
        c.status !== "CANCELLED" &&
        c.status !== "RESOLVED",
    );
    items.push(
      {
        category: "Open Service Calls",
        count: openCalls.length,
        blocking: openCalls.length > 0,
      },
      { category: "Completed Service Calls", count: relatedCalls.length - openCalls.length },
      { category: "PM Records", count: 1 },
      { category: "Meter History", count: 1 },
      { category: "Parts Usage", count: relatedCalls.reduce((n, c) => n + (c.parts?.length ?? 0), 0) },
      { category: "Attachments", count: 0 },
      { category: "Diagnostics", count: 0 },
    );
    if (openCalls.length > 0) {
      canSoftDelete = false;
      blockers.push(
        "This machine cannot be deleted while open service calls exist. Prefer retirement or archive.",
      );
    }
    if (relatedCalls.length > 0) {
      blockers.push(
        "Service history exists — prefer archive or retirement for valid historical machines.",
      );
      if (relatedCalls.length > 2) canSoftDelete = false;
    }
    canRestore = state?.lifecycle === "DELETED" || state?.lifecycle === "ARCHIVED";
  }

  if (recordType === "PART") {
    const part = getCatalogPart(recordId);
    if (!part) {
      return emptyImpact(recordType, recordId, ["Part not found."]);
    }
    const txns = listTransactions(500).filter((t) => t.partId === recordId);
    items.push(
      {
        category: "Inventory Transactions",
        count: txns.length,
        blocking: txns.length > 0,
      },
    );
    if (txns.length > 0) {
      canSoftDelete = false;
      blockers.push(
        "Parts used in historical transactions cannot be deleted. Archive instead.",
      );
    }
    canPermanentlyDelete = false;
  }

  if (recordType === "METER" || recordType === "PM_HISTORY" || recordType === "PM_SCHEDULE") {
    items.push({
      category: "Derived Calculations",
      count: 1,
      detail: "Corrections recalculate through existing PM scheduling logic only.",
    });
    canRestore = state?.lifecycle === "DELETED" || state?.lifecycle === "ARCHIVED";
  }

  if (state?.lifecycle === "DELETED") {
    canArchive = false;
    canSoftDelete = false;
    canRestore = true;
    canPermanentlyDelete =
      PERMANENT_DELETE_ENABLED_BY_DEFAULT && blockers.length === 0;
    if (!PERMANENT_DELETE_ENABLED_BY_DEFAULT) {
      blockers.push(
        "Permanent deletion is disabled by default and blocked when financial, inventory, warranty, compliance, or audit integrity would be damaged.",
      );
    }
  }

  return {
    recordType,
    recordId,
    items,
    canArchive,
    canSoftDelete,
    canRestore,
    canPermanentlyDelete,
    blockers,
  };
}

function emptyImpact(
  recordType: AdminRecordType,
  recordId: string,
  blockers: string[],
): RelationshipImpact {
  return {
    recordType,
    recordId,
    items: [],
    canArchive: false,
    canSoftDelete: false,
    canRestore: false,
    canPermanentlyDelete: false,
    blockers,
  };
}
