/**
 * Patch 51C.2 — Internal customer operational-risk scoring + audited overrides.
 * Overrides never auto-mutate CRM/production records beyond the override store + audit.
 */

import { listCustomers } from "@/lib/crm/repository";
import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { computeCustomerReliabilityScore } from "../customer-reliability";
import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { prisma } from "@/lib/db/prisma";
import type { ForecastMeta } from "./types";
import { buildMeta } from "./forecasting";

export type CustomerOperationalRiskRow = {
  customerId: string;
  name: string;
  baseScore: number;
  effectiveScore: number;
  riskLabel: string;
  factors: Array<{ key: string; note: string; penalty: number }>;
  override: {
    score: number;
    note: string;
    updatedAt: string;
    updatedBy: string;
  } | null;
  href: string;
};

type OverrideRecord = {
  customerId: string;
  score: number;
  note: string;
  updatedAt: string;
  updatedBy: string;
  organizationId: string;
};

const memoryOverrides = new Map<string, OverrideRecord>();

function overrideKey(organizationId: string, customerId: string) {
  return `${organizationId}::${customerId}`;
}

export function getCustomerRiskOverride(
  organizationId: string,
  customerId: string,
): OverrideRecord | null {
  return memoryOverrides.get(overrideKey(organizationId, customerId)) ?? null;
}

export async function setCustomerRiskOverride(input: {
  organizationId?: string;
  customerId: string;
  score: number;
  note: string;
  actorId: string;
  actorName?: string;
}): Promise<{ ok: true; override: OverrideRecord } | { ok: false; error: string }> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const score = Math.max(0, Math.min(100, Math.round(input.score)));
  const note = input.note.trim();
  if (!input.customerId.trim()) return { ok: false, error: "customerId required" };
  if (!note) return { ok: false, error: "Override note is required for audit." };

  const override: OverrideRecord = {
    customerId: input.customerId,
    score,
    note,
    updatedAt: new Date().toISOString(),
    updatedBy: input.actorName || input.actorId,
    organizationId,
  };
  memoryOverrides.set(overrideKey(organizationId, input.customerId), override);

  await writeAdminAudit({
    organizationId,
    actorId: input.actorId,
    action: "CUSTOMER_OPERATIONAL_RISK_OVERRIDE",
    entityType: "CustomerOperationalRisk",
    entityId: input.customerId,
    message: `Override score=${score}: ${note}`,
    category: "AI_OPERATIONS",
    severity: "INFO",
    outcome: "SUCCESS",
  }).catch(() => undefined);

  return { ok: true, override };
}

export async function getCustomerOperationalRisk(input?: {
  organizationId?: string;
  now?: Date;
}): Promise<{
  meta: ForecastMeta;
  customers: CustomerOperationalRiskRow[];
}> {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const now = input?.now ?? new Date();
  const customers = listCustomers(1, 200).items;
  const calls = listServiceCalls({ includeDeleted: false });
  const open = calls.filter((c) => isOpenServiceCallStatus(c.status));

  const snapshots = await prisma.machineHealthSnapshot.findMany({
    where: { organizationId },
    orderBy: { generatedAt: "desc" },
    take: 400,
    select: { machineId: true, riskLevel: true, generatedAt: true },
  });
  const latest = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!latest.has(s.machineId)) latest.set(s.machineId, s);
  }

  const rows: CustomerOperationalRiskRow[] = customers.map((c) => {
    const related = open.filter(
      (call) =>
        call.machine.customerName?.toLowerCase() === c.name.toLowerCase() ||
        call.machine.customerName?.toLowerCase().includes(c.name.toLowerCase()),
    );
    const crit = related.filter(
      (call) =>
        call.priority === "CRITICAL" ||
        call.priority === "EMERGENCY" ||
        call.problem.machineCurrentlyDown,
    );
    const machinesAtRisk = [...latest.values()].filter((s) => {
      if (s.riskLevel !== "HIGH" && s.riskLevel !== "CRITICAL") return false;
      return related.some(
        (call) =>
          call.machine.machineId?.toLowerCase() === s.machineId.toLowerCase(),
      );
    }).length;

    const scored = computeCustomerReliabilityScore({
      openCalls: related.length,
      criticalCalls: crit.length,
      machinesAtRisk,
    });
    const ov = getCustomerRiskOverride(organizationId, c.id);
    return {
      customerId: c.id,
      name: c.name,
      baseScore: scored.reliabilityScore,
      effectiveScore: ov?.score ?? scored.reliabilityScore,
      riskLabel: scored.riskLabel,
      factors: scored.factors,
      override: ov
        ? {
            score: ov.score,
            note: ov.note,
            updatedAt: ov.updatedAt,
            updatedBy: ov.updatedBy,
          }
        : null,
      href: `/customers/${encodeURIComponent(c.id)}`,
    };
  });

  rows.sort((a, b) => a.effectiveScore - b.effectiveScore);

  const meta = buildMeta({
    metric: "customer_service_health",
    scope: "internal_executive_only",
    method: rows.length === 0 ? "insufficient_data" : "run_rate",
    methodLabel:
      "Customer Service Health from open/critical calls + predictive risk + optional overrides",
    horizon: "MONTH",
    recordCount: rows.length,
    periodsWithData: rows.length > 0 ? 1 : 0,
    newestIso: now.toISOString(),
    assumptions: [
      "Base score uses 51C.1 customer reliability penalties.",
      "Overrides are audited and session-memory persisted (not CRM writes).",
      "Internal scores must not enter customer-facing / portal APIs.",
      "Customer isolation: executive permissions only.",
    ],
    now,
  });

  return { meta, customers: rows.slice(0, 50) };
}
