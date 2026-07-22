/**
 * Patch 50A — Approval type registry (extensible without large switch statements).
 */

import type { ApprovalType } from "./types";

export type ApprovalTypeDescriptor = {
  type: ApprovalType | string;
  label: string;
  sourceModule?: string;
  fields: Array<
    | "requestedAmount"
    | "currency"
    | "customerId"
    | "machineId"
    | "serviceCallId"
    | "partsOrderId"
    | "dueAt"
    | "businessJustification"
  >;
};

const registry = new Map<string, ApprovalTypeDescriptor>();

const DEFAULTS: ApprovalTypeDescriptor[] = [
  {
    type: "PARTS_ORDER",
    label: "Parts Order",
    sourceModule: "parts",
    fields: [
      "requestedAmount",
      "currency",
      "customerId",
      "machineId",
      "serviceCallId",
      "partsOrderId",
      "dueAt",
      "businessJustification",
    ],
  },
  {
    type: "PURCHASE_REQUEST",
    label: "Purchase Request",
    sourceModule: "purchasing",
    fields: ["requestedAmount", "currency", "dueAt", "businessJustification"],
  },
  {
    type: "INVENTORY_ADJUSTMENT",
    label: "Inventory Adjustment",
    sourceModule: "inventory",
    fields: ["requestedAmount", "businessJustification"],
  },
  {
    type: "WARRANTY_CLAIM",
    label: "Warranty Claim",
    sourceModule: "warranty",
    fields: [
      "customerId",
      "machineId",
      "serviceCallId",
      "requestedAmount",
      "businessJustification",
    ],
  },
  {
    type: "PM_SCHEDULE_CHANGE",
    label: "PM Schedule Change",
    sourceModule: "pm",
    fields: ["machineId", "customerId", "dueAt", "businessJustification"],
  },
  {
    type: "USER_ACCESS_REQUEST",
    label: "User Access Request",
    sourceModule: "admin",
    fields: ["businessJustification"],
  },
  {
    type: "EXPENSE_REQUEST",
    label: "Expense Request",
    sourceModule: "finance",
    fields: ["requestedAmount", "currency", "dueAt", "businessJustification"],
  },
  {
    type: "EMERGENCY_REQUEST",
    label: "Emergency Request",
    sourceModule: "operations",
    fields: [
      "customerId",
      "machineId",
      "serviceCallId",
      "requestedAmount",
      "businessJustification",
      "dueAt",
    ],
  },
  {
    type: "GENERAL_REQUEST",
    label: "General Request",
    sourceModule: "general",
    fields: ["requestedAmount", "currency", "dueAt", "businessJustification"],
  },
];

for (const d of DEFAULTS) {
  registry.set(d.type, d);
}

/** Register or replace an approval type for a future Matrix module. */
export function registerApprovalType(descriptor: ApprovalTypeDescriptor) {
  registry.set(descriptor.type, descriptor);
}

export function getApprovalType(type: string): ApprovalTypeDescriptor | undefined {
  return registry.get(type);
}

export function listApprovalTypes(): ApprovalTypeDescriptor[] {
  return Array.from(registry.values());
}

export function isKnownApprovalType(type: string): boolean {
  return registry.has(type);
}
