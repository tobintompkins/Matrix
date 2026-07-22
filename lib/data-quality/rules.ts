/**
 * Patch 50C-1 — System rule registry (declarative; no arbitrary code).
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { DataQualityModule, DataQualitySeverity } from "./score";

export type SystemRuleDef = {
  code: string;
  name: string;
  description: string;
  module: DataQualityModule;
  entityType: string;
  ruleType: string;
  severity: DataQualitySeverity;
  configuration: Record<string, unknown>;
};

export const SYSTEM_RULES: SystemRuleDef[] = [
  {
    code: "DUP_CUSTOMER_ACCOUNT",
    name: "Duplicate Customer Account Number",
    description: "Two or more active customers share the same account/customer number.",
    module: "customers",
    entityType: "Customer",
    ruleType: "UNIQUE_FIELD",
    severity: "CRITICAL",
    configuration: { field: "customerNumber" },
  },
  {
    code: "DUP_CUSTOMER_NAME_ADDR",
    name: "Duplicate Customer Name + Address",
    description: "Normalized customer name and address match another active customer.",
    module: "customers",
    entityType: "Customer",
    ruleType: "COMPOSITE_DUPLICATE",
    severity: "HIGH",
    configuration: { fields: ["name", "address"] },
  },
  {
    code: "MISS_CUSTOMER_NAME",
    name: "Missing Customer Name",
    description: "Active customer is missing a display/legal name.",
    module: "customers",
    entityType: "Customer",
    ruleType: "REQUIRED_FIELD",
    severity: "HIGH",
    configuration: { field: "name" },
  },
  {
    code: "DUP_MACHINE_SERIAL",
    name: "Duplicate Machine Serial Number",
    description: "Two or more active machines share the same normalized serial number.",
    module: "machines",
    entityType: "Machine",
    ruleType: "UNIQUE_FIELD",
    severity: "CRITICAL",
    configuration: { field: "serialNumber" },
  },
  {
    code: "MISS_MACHINE_SERIAL",
    name: "Missing Machine Serial Number",
    description: "Active machine is missing a serial number.",
    module: "machines",
    entityType: "Machine",
    ruleType: "REQUIRED_FIELD",
    severity: "HIGH",
    configuration: { field: "serialNumber" },
  },
  {
    code: "MISS_MACHINE_CUSTOMER",
    name: "Missing Machine Customer",
    description: "Active machine has no customer assignment.",
    module: "machines",
    entityType: "Machine",
    ruleType: "RELATIONSHIP_REQUIRED",
    severity: "CRITICAL",
    configuration: { field: "customerName" },
  },
  {
    code: "MISS_MACHINE_LOCATION",
    name: "Missing Machine Location",
    description: "Active machine has no site/location assignment.",
    module: "machines",
    entityType: "Machine",
    ruleType: "RELATIONSHIP_REQUIRED",
    severity: "HIGH",
    configuration: { field: "siteName" },
  },
  {
    code: "DUP_PART_NUMBER",
    name: "Duplicate Part Number",
    description: "Two or more catalog parts share the same normalized part number.",
    module: "parts",
    entityType: "Part",
    ruleType: "UNIQUE_FIELD",
    severity: "CRITICAL",
    configuration: { field: "partNumber" },
  },
  {
    code: "MISS_PART_NUMBER",
    name: "Missing Part Number",
    description: "Catalog part is missing a part number.",
    module: "parts",
    entityType: "Part",
    ruleType: "REQUIRED_FIELD",
    severity: "HIGH",
    configuration: { field: "partNumber" },
  },
  {
    code: "INV_NEGATIVE_ON_HAND",
    name: "Negative Inventory On Hand",
    description: "Inventory balance reports a negative on-hand quantity.",
    module: "inventory",
    entityType: "InventoryBalance",
    ruleType: "VALID_RANGE",
    severity: "CRITICAL",
    configuration: { field: "onHand" },
  },
  {
    code: "INV_ALLOC_GT_ON_HAND",
    name: "Allocated Exceeds On Hand",
    description: "Allocated quantity is greater than on-hand quantity.",
    module: "inventory",
    entityType: "InventoryBalance",
    ruleType: "BUSINESS_RULE_VIOLATION",
    severity: "HIGH",
    configuration: {},
  },
  {
    code: "SVC_MISSING_CUSTOMER",
    name: "Service Call Without Customer",
    description: "Service call is missing customer name.",
    module: "serviceCalls",
    entityType: "ServiceCall",
    ruleType: "RELATIONSHIP_REQUIRED",
    severity: "HIGH",
    configuration: {},
  },
  {
    code: "SVC_CLOSED_NO_RESOLUTION",
    name: "Closed Service Call Without Resolution",
    description: "Closed/resolved call is missing a resolution summary.",
    module: "serviceCalls",
    entityType: "ServiceCall",
    ruleType: "REQUIRED_FIELD",
    severity: "MEDIUM",
    configuration: {},
  },
  {
    code: "SVC_OPEN_WITH_CLOSED_DATE",
    name: "Open Call With Closed Date",
    description: "Open service call has a closed date set.",
    module: "serviceCalls",
    entityType: "ServiceCall",
    ruleType: "STATUS_CONSISTENCY",
    severity: "HIGH",
    configuration: {},
  },
  {
    code: "METER_LOWER_THAN_PREV",
    name: "Meter Reading Lower Than Previous",
    description: "Accepted meter sequence decreases for a machine.",
    module: "meters",
    entityType: "MeterReading",
    ruleType: "SEQUENCE_ERROR",
    severity: "HIGH",
    configuration: {},
  },
  {
    code: "PORTAL_USER_NO_CUSTOMER",
    name: "Portal User Without Customer Access",
    description: "Active/invited portal membership lacks a customerId.",
    module: "portal",
    entityType: "CustomerMembership",
    ruleType: "RELATIONSHIP_REQUIRED",
    severity: "CRITICAL",
    configuration: {},
  },
  {
    code: "APPROVAL_PENDING_NO_STEP",
    name: "Pending Approval Without Active Step",
    description: "Pending approval request has no active workflow step.",
    module: "approvals",
    entityType: "ApprovalRequest",
    ruleType: "BUSINESS_RULE_VIOLATION",
    severity: "HIGH",
    configuration: {},
  },
  {
    code: "ORPHAN_INV_TXN_PART",
    name: "Inventory Transaction Without Part",
    description: "Inventory transaction references a missing catalog part.",
    module: "inventory",
    entityType: "InventoryTransaction",
    ruleType: "ORPHANED_RECORD",
    severity: "MEDIUM",
    configuration: {},
  },
];

export async function ensureSystemRulesSeeded(organizationId = DEFAULT_ORG_ID) {
  for (const rule of SYSTEM_RULES) {
    const existing = await prisma.dataQualityRule.findFirst({
      where: { organizationId, code: rule.code },
    });
    if (existing) continue;
    await prisma.dataQualityRule.create({
      data: {
        organizationId,
        code: rule.code,
        name: rule.name,
        description: rule.description,
        module: rule.module,
        entityType: rule.entityType,
        ruleType: rule.ruleType,
        severity: rule.severity,
        isActive: true,
        isSystemRule: true,
        configurationJson: JSON.stringify(rule.configuration),
      },
    });
  }
}

export async function listDataQualityRules(organizationId: string) {
  await ensureSystemRulesSeeded(organizationId);
  return prisma.dataQualityRule.findMany({
    where: { organizationId },
    orderBy: [{ module: "asc" }, { name: "asc" }],
  });
}
