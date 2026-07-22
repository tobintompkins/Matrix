/**
 * Patch 50C-1 — Read-only detectors (never mutate source records).
 */

import { listAdminCustomers } from "@/lib/admin/data/customers";
import { listAdminMachines } from "@/lib/admin/data/machines";
import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import {
  listBalances,
  listCatalog,
  listTransactions,
} from "@/lib/inventory/enterprise-repository";
import { listMeterTableRows } from "@/lib/pm-intelligence/repository";
import { prisma } from "@/lib/db/prisma";
import {
  normalizeKey,
  type DetectedFinding,
  type DataQualitySettings,
} from "./score";

export async function detectDataQualityFindings(
  settings: DataQualitySettings,
): Promise<DetectedFinding[]> {
  const findings: DetectedFinding[] = [];

  // Customers
  const customers = listAdminCustomers({
    recordState: "ACTIVE",
    pageSize: settings.scanBatchSize,
  }).items;
  const byAccount = new Map<string, string[]>();
  const byNameAddr = new Map<string, string[]>();
  for (const c of customers) {
    if (!String(c.name ?? "").trim()) {
      findings.push({
        issueKey: `MISS_CUSTOMER_NAME:${c.id}`,
        module: "customers",
        entityType: "Customer",
        entityId: c.id,
        issueType: "MISSING_REQUIRED_VALUE",
        severity: "HIGH",
        title: "Missing customer name",
        description: `Customer ${c.customerNumber || c.id} is missing a name.`,
        fieldName: "name",
        currentValue: "",
        expectedValue: "Non-empty name",
        ruleCode: "MISS_CUSTOMER_NAME",
        confidenceScore: 1,
      });
    }
    const acct = normalizeKey(String(c.customerNumber ?? ""));
    if (acct) {
      const list = byAccount.get(acct) ?? [];
      list.push(c.id);
      byAccount.set(acct, list);
    }
    const nameAddr = `${normalizeKey(String(c.name ?? ""))}|${normalizeKey(
      String(c.region ?? ""),
    )}`;
    if (nameAddr !== "|") {
      const list = byNameAddr.get(nameAddr) ?? [];
      list.push(c.id);
      byNameAddr.set(nameAddr, list);
    }
  }
  for (const [key, ids] of byAccount) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      findings.push({
        issueKey: `DUP_CUSTOMER_ACCOUNT:${key}:${id}`,
        module: "customers",
        entityType: "Customer",
        entityId: id,
        secondaryEntityId: ids.find((x) => x !== id) ?? null,
        issueType: "DUPLICATE",
        severity: "CRITICAL",
        title: "Duplicate customer account number",
        description: `${ids.length} active customers share account key ${key}.`,
        fieldName: "customerNumber",
        currentValue: key,
        evidence: JSON.stringify({ peerIds: ids }),
        ruleCode: "DUP_CUSTOMER_ACCOUNT",
        confidenceScore: 0.98,
      });
    }
  }
  for (const [key, ids] of byNameAddr) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      findings.push({
        issueKey: `DUP_CUSTOMER_NAME_ADDR:${key}:${id}`,
        module: "customers",
        entityType: "Customer",
        entityId: id,
        secondaryEntityId: ids.find((x) => x !== id) ?? null,
        issueType: "POSSIBLE_MERGE",
        severity: "HIGH",
        title: "Possible duplicate customer (name + address)",
        description: `${ids.length} customers share normalized name/address.`,
        evidence: JSON.stringify({ peerIds: ids }),
        ruleCode: "DUP_CUSTOMER_NAME_ADDR",
        confidenceScore: 0.86,
      });
    }
  }

  // Machines
  const machines = listAdminMachines({
    recordState: "ACTIVE",
    pageSize: settings.scanBatchSize,
  }).items;
  const bySerial = new Map<string, string[]>();
  for (const m of machines) {
    if (!String(m.serialNumber ?? "").trim()) {
      findings.push({
        issueKey: `MISS_MACHINE_SERIAL:${m.machineId}`,
        module: "machines",
        entityType: "Machine",
        entityId: m.machineId,
        issueType: "MISSING_REQUIRED_VALUE",
        severity: "HIGH",
        title: "Missing machine serial number",
        description: `Machine ${m.nickname || m.machineId} has no serial number.`,
        fieldName: "serialNumber",
        ruleCode: "MISS_MACHINE_SERIAL",
        confidenceScore: 1,
      });
    }
    if (!String(m.customerName ?? "").trim()) {
      findings.push({
        issueKey: `MISS_MACHINE_CUSTOMER:${m.machineId}`,
        module: "machines",
        entityType: "Machine",
        entityId: m.machineId,
        issueType: "ORPHANED_RECORD",
        severity: "CRITICAL",
        title: "Machine missing customer",
        description: `Machine ${m.serialNumber || m.machineId} has no customer.`,
        fieldName: "customerName",
        ruleCode: "MISS_MACHINE_CUSTOMER",
        confidenceScore: 1,
      });
    }
    if (!String(m.siteName ?? "").trim()) {
      findings.push({
        issueKey: `MISS_MACHINE_LOCATION:${m.machineId}`,
        module: "machines",
        entityType: "Machine",
        entityId: m.machineId,
        issueType: "MISSING_REQUIRED_VALUE",
        severity: "HIGH",
        title: "Machine missing location",
        description: `Machine ${m.serialNumber || m.machineId} has no site/location.`,
        fieldName: "siteName",
        ruleCode: "MISS_MACHINE_LOCATION",
        confidenceScore: 1,
      });
    }
    const serial = normalizeKey(String(m.serialNumber ?? ""));
    if (serial) {
      const list = bySerial.get(serial) ?? [];
      list.push(m.machineId);
      bySerial.set(serial, list);
    }
  }
  for (const [key, ids] of bySerial) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      findings.push({
        issueKey: `DUP_MACHINE_SERIAL:${key}:${id}`,
        module: "machines",
        entityType: "Machine",
        entityId: id,
        secondaryEntityId: ids.find((x) => x !== id) ?? null,
        issueType: "DUPLICATE",
        severity: "CRITICAL",
        title: "Duplicate machine serial number",
        description: `${ids.length} active machines share serial ${key}.`,
        fieldName: "serialNumber",
        currentValue: key,
        evidence: JSON.stringify({ peerIds: ids }),
        ruleCode: "DUP_MACHINE_SERIAL",
        confidenceScore: 0.99,
      });
    }
  }

  // Parts
  const parts = listCatalog("", 1, settings.scanBatchSize).items;
  const byPart = new Map<string, string[]>();
  for (const p of parts) {
    if (!String(p.partNumber ?? "").trim()) {
      findings.push({
        issueKey: `MISS_PART_NUMBER:${p.id}`,
        module: "parts",
        entityType: "Part",
        entityId: p.id,
        issueType: "MISSING_REQUIRED_VALUE",
        severity: "HIGH",
        title: "Missing part number",
        description: `Part ${p.id} is missing a part number.`,
        fieldName: "partNumber",
        ruleCode: "MISS_PART_NUMBER",
        confidenceScore: 1,
      });
    }
    const pn = normalizeKey(String(p.partNumber ?? ""));
    if (pn) {
      const list = byPart.get(pn) ?? [];
      list.push(p.id);
      byPart.set(pn, list);
    }
  }
  for (const [key, ids] of byPart) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      findings.push({
        issueKey: `DUP_PART_NUMBER:${key}:${id}`,
        module: "parts",
        entityType: "Part",
        entityId: id,
        secondaryEntityId: ids.find((x) => x !== id) ?? null,
        issueType: "DUPLICATE",
        severity: "CRITICAL",
        title: "Duplicate part number",
        description: `${ids.length} parts share part number ${key}.`,
        fieldName: "partNumber",
        currentValue: key,
        ruleCode: "DUP_PART_NUMBER",
        confidenceScore: 0.98,
      });
    }
  }

  // Inventory
  const balances = listBalances();
  for (const b of balances) {
    const onHand = Number(b.quantityOnHand ?? 0);
    const reserved = Number(b.quantityReserved ?? 0);
    const balId = `${b.partId}:${b.locationId}`;
    if (onHand < 0) {
      findings.push({
        issueKey: `INV_NEGATIVE_ON_HAND:${balId}`,
        module: "inventory",
        entityType: "InventoryBalance",
        entityId: balId,
        issueType: "INVALID_VALUE",
        severity: "CRITICAL",
        title: "Negative on-hand quantity",
        description: `Part ${b.partId} at ${b.locationId} has on-hand ${onHand}.`,
        fieldName: "quantityOnHand",
        currentValue: String(onHand),
        expectedValue: ">= 0",
        ruleCode: "INV_NEGATIVE_ON_HAND",
        confidenceScore: 1,
      });
    }
    if (reserved > onHand) {
      findings.push({
        issueKey: `INV_ALLOC_GT_ON_HAND:${balId}`,
        module: "inventory",
        entityType: "InventoryBalance",
        entityId: balId,
        issueType: "BUSINESS_RULE_VIOLATION",
        severity: "HIGH",
        title: "Allocated exceeds on hand",
        description: `Reserved ${reserved} > on-hand ${onHand}.`,
        currentValue: `${reserved}/${onHand}`,
        ruleCode: "INV_ALLOC_GT_ON_HAND",
        confidenceScore: 1,
      });
    }
  }
  const partIds = new Set(parts.map((p) => p.id));
  for (const t of listTransactions(200)) {
    if (t.partId && !partIds.has(t.partId)) {
      findings.push({
        issueKey: `ORPHAN_INV_TXN_PART:${t.id}`,
        module: "inventory",
        entityType: "InventoryTransaction",
        entityId: t.id,
        issueType: "ORPHANED_RECORD",
        severity: "MEDIUM",
        title: "Inventory transaction without catalog part",
        description: `Transaction ${t.id} references missing part ${t.partId}.`,
        ruleCode: "ORPHAN_INV_TXN_PART",
        confidenceScore: 0.95,
      });
    }
  }

  // Service calls
  const calls = listServiceCalls({ includeDeleted: false, includeArchived: false });
  for (const c of calls.slice(0, settings.scanBatchSize)) {
    if (!String(c.machine.customerName ?? "").trim()) {
      findings.push({
        issueKey: `SVC_MISSING_CUSTOMER:${c.id}`,
        module: "serviceCalls",
        entityType: "ServiceCall",
        entityId: c.id,
        issueType: "BROKEN_RELATIONSHIP",
        severity: "HIGH",
        title: "Service call without customer",
        description: `Call ${c.ticketNumber || c.id} has no customer name.`,
        ruleCode: "SVC_MISSING_CUSTOMER",
        confidenceScore: 1,
      });
    }
    const closedLike = c.status === "CLOSED" || c.status === "RESOLVED";
    if (
      closedLike &&
      !String(c.resolution.resolutionSummary ?? "").trim()
    ) {
      findings.push({
        issueKey: `SVC_CLOSED_NO_RESOLUTION:${c.id}`,
        module: "serviceCalls",
        entityType: "ServiceCall",
        entityId: c.id,
        issueType: "MISSING_REQUIRED_VALUE",
        severity: "MEDIUM",
        title: "Closed call without resolution",
        description: `Call ${c.ticketNumber || c.id} is ${c.status} without resolution summary.`,
        fieldName: "resolutionSummary",
        ruleCode: "SVC_CLOSED_NO_RESOLUTION",
        confidenceScore: 1,
      });
    }
    if (isOpenServiceCallStatus(c.status) && c.closedAt) {
      findings.push({
        issueKey: `SVC_OPEN_WITH_CLOSED_DATE:${c.id}`,
        module: "serviceCalls",
        entityType: "ServiceCall",
        entityId: c.id,
        issueType: "INCONSISTENT_STATUS",
        severity: "HIGH",
        title: "Open call with closed date",
        description: `Call ${c.ticketNumber || c.id} is open but closedAt is set.`,
        currentValue: c.closedAt,
        ruleCode: "SVC_OPEN_WITH_CLOSED_DATE",
        confidenceScore: 1,
      });
    }
  }

  // Meters — lower than previous within row history if exposed
  try {
    const meters = listMeterTableRows();
    for (const row of meters.slice(0, settings.scanBatchSize)) {
      const current = row.currentMeter;
      const last = row.previousMeter;
      if (
        typeof current === "number" &&
        typeof last === "number" &&
        current < last
      ) {
        findings.push({
          issueKey: `METER_LOWER_THAN_PREV:${row.printerId}`,
          module: "meters",
          entityType: "MeterReading",
          entityId: row.printerId,
          issueType: "SEQUENCE_ERROR",
          severity: "HIGH",
          title: "Meter lower than previous baseline",
          description: `Machine ${row.printerId} current ${current} < previous ${last}.`,
          currentValue: String(current),
          expectedValue: `>= ${last}`,
          ruleCode: "METER_LOWER_THAN_PREV",
          confidenceScore: 0.9,
        });
      }
    }
  } catch {
    /* meter store optional */
  }

  // Portal memberships
  try {
    const memberships = await prisma.customerMembership.findMany({
      where: { status: { in: ["ACTIVE", "INVITED"] } },
      take: settings.scanBatchSize,
    });
    for (const m of memberships) {
      if (!m.customerId) {
        findings.push({
          issueKey: `PORTAL_USER_NO_CUSTOMER:${m.id}`,
          module: "portal",
          entityType: "CustomerMembership",
          entityId: m.id,
          issueType: "BROKEN_RELATIONSHIP",
          severity: "CRITICAL",
          title: "Portal user without customer access",
          description: `Membership ${m.id} has no customerId.`,
          ruleCode: "PORTAL_USER_NO_CUSTOMER",
          confidenceScore: 1,
        });
      }
    }
  } catch {
    /* portal optional */
  }

  // Approvals
  try {
    const pending = await prisma.approvalRequest.findMany({
      where: { status: { in: ["PENDING", "IN_REVIEW", "ESCALATED"] } },
      include: { steps: true },
      take: 200,
    });
    for (const req of pending) {
      const active = (req.steps ?? []).some(
        (s) => s.status === "PENDING" || s.status === "IN_REVIEW" || s.status === "ACTIVE",
      );
      if (!active && (req.steps?.length ?? 0) === 0) {
        findings.push({
          issueKey: `APPROVAL_PENDING_NO_STEP:${req.id}`,
          module: "approvals",
          entityType: "ApprovalRequest",
          entityId: req.id,
          issueType: "BUSINESS_RULE_VIOLATION",
          severity: "HIGH",
          title: "Pending approval without active step",
          description: `Approval ${req.requestNumber ?? req.id} has no workflow steps.`,
          ruleCode: "APPROVAL_PENDING_NO_STEP",
          confidenceScore: 0.95,
        });
      }
    }
  } catch {
    /* approvals optional */
  }

  return findings;
}
