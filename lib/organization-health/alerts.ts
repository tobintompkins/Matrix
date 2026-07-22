/**
 * Patch 50B — Deterministic operational health alerts.
 */

import { prisma } from "@/lib/db/prisma";
import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { HealthSettings } from "./score";

export type HealthAlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export async function syncOrganizationHealthAlerts(input: {
  actor: AdminActor;
  settings: HealthSettings;
  kpis: Record<string, number | string | null>;
}) {
  const { actor, settings, kpis } = input;
  const candidates: Array<{
    alertKey: string;
    category: string;
    severity: HealthAlertSeverity;
    title: string;
    description: string;
    evidence: string;
    sourceType: string;
    sourceRecordId?: string;
    recommendedAction: string;
  }> = [];

  const fleetAvail =
    typeof kpis.fleetAvailability === "number" ? kpis.fleetAvailability : null;
  if (
    fleetAvail != null &&
    fleetAvail < settings.fleetAvailabilityWatchBelow
  ) {
    candidates.push({
      alertKey: "fleet-availability-low",
      category: "fleet",
      severity: fleetAvail < 70 ? "CRITICAL" : "HIGH",
      title: "Fleet availability below threshold",
      description: `Fleet availability is ${fleetAvail}% (watch below ${settings.fleetAvailabilityWatchBelow}%).`,
      evidence: JSON.stringify({ fleetAvailability: fleetAvail }),
      sourceType: "FleetMetrics",
      recommendedAction: "Review out-of-service and degraded machines.",
    });
  }

  const criticalOpen =
    typeof kpis.criticalOpenCalls === "number" ? kpis.criticalOpenCalls : 0;
  if (criticalOpen > 0) {
    candidates.push({
      alertKey: "service-critical-open",
      category: "service",
      severity: criticalOpen >= 5 ? "CRITICAL" : "HIGH",
      title: "Critical open service calls",
      description: `${criticalOpen} critical/urgent open service calls require attention.`,
      evidence: JSON.stringify({ criticalOpenCalls: criticalOpen }),
      sourceType: "ServiceCalls",
      recommendedAction: "Open Service Operations drill-down and assign owners.",
    });
  }

  const unassigned =
    typeof kpis.unassignedCalls === "number" ? kpis.unassignedCalls : 0;
  if (unassigned > 0) {
    candidates.push({
      alertKey: "service-unassigned",
      category: "service",
      severity: unassigned >= 5 ? "HIGH" : "MEDIUM",
      title: "Unassigned service calls",
      description: `${unassigned} open calls have no technician assigned.`,
      evidence: JSON.stringify({ unassignedCalls: unassigned }),
      sourceType: "ServiceCalls",
      recommendedAction: "Assign technicians to unassigned work.",
    });
  }

  const pm =
    typeof kpis.pmCompliance === "number" ? kpis.pmCompliance : null;
  if (pm != null && pm < settings.pmComplianceWatchBelow) {
    candidates.push({
      alertKey: "pm-compliance-low",
      category: "pm",
      severity: pm < 70 ? "CRITICAL" : "HIGH",
      title: "PM compliance below threshold",
      description: `PM compliance is ${pm}% (watch below ${settings.pmComplianceWatchBelow}%).`,
      evidence: JSON.stringify({ pmCompliance: pm }),
      sourceType: "PmIntelligence",
      recommendedAction: "Assign overdue PMs and review meter thresholds.",
    });
  }

  const stockout =
    typeof kpis.inventoryOutOfStock === "number" ? kpis.inventoryOutOfStock : 0;
  if (stockout > settings.inventoryStockoutWatchAbove) {
    candidates.push({
      alertKey: "inventory-stockout",
      category: "inventory",
      severity: stockout >= 10 ? "CRITICAL" : "HIGH",
      title: "Inventory stockout exposure",
      description: `${stockout} parts are out of stock.`,
      evidence: JSON.stringify({ outOfStock: stockout }),
      sourceType: "Inventory",
      recommendedAction: "Review reorder and emergency parts orders.",
    });
  }

  const overdueApprovals =
    typeof kpis.overdueApprovals === "number" ? kpis.overdueApprovals : 0;
  if (overdueApprovals > 0) {
    candidates.push({
      alertKey: "approvals-overdue",
      category: "approvals",
      severity: overdueApprovals >= 3 ? "CRITICAL" : "HIGH",
      title: "Overdue approvals blocking operations",
      description: `${overdueApprovals} Approval Center requests are overdue.`,
      evidence: JSON.stringify({ overdueApprovals }),
      sourceType: "ApprovalCenter",
      recommendedAction: "Open Approval Center filtered to overdue requests.",
    });
  }

  const atRisk =
    typeof kpis.atRiskCustomers === "number" ? kpis.atRiskCustomers : 0;
  if (atRisk > 0) {
    candidates.push({
      alertKey: "customer-at-risk",
      category: "customer",
      severity: atRisk >= 5 ? "HIGH" : "MEDIUM",
      title: "Customer service risk accounts",
      description: `${atRisk} customers have elevated open critical or aging service risk.`,
      evidence: JSON.stringify({ atRiskCustomers: atRisk }),
      sourceType: "CustomerHealth",
      recommendedAction: "Review Customer Health drill-down.",
    });
  }

  for (const c of candidates) {
    const existing = await prisma.organizationHealthAlert.findFirst({
      where: {
        organizationId: actor.organizationId,
        alertKey: c.alertKey,
        status: { in: ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"] },
      },
    });
    if (existing) continue;
    await prisma.organizationHealthAlert.create({
      data: {
        organizationId: actor.organizationId,
        alertKey: c.alertKey,
        category: c.category,
        severity: c.severity,
        title: c.title,
        description: c.description,
        evidence: c.evidence,
        sourceType: c.sourceType,
        sourceRecordId: c.sourceRecordId ?? null,
        status: "OPEN",
        recommendedAction: c.recommendedAction,
        detectedAt: new Date(),
      },
    });
  }

  return listOrganizationHealthAlerts(actor.organizationId);
}

export async function listOrganizationHealthAlerts(organizationId: string) {
  return prisma.organizationHealthAlert.findMany({
    where: { organizationId },
    orderBy: [{ status: "asc" }, { detectedAt: "desc" }],
    take: 200,
  });
}

export async function acknowledgeHealthAlert(input: {
  actor: AdminActor;
  id: string;
}) {
  const row = await prisma.organizationHealthAlert.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Alert not found." };
  const updated = await prisma.organizationHealthAlert.update({
    where: { id: row.id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedByUserId: input.actor.userId,
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "HEALTH_ALERT_ACKNOWLEDGED",
    entityType: "OrganizationHealthAlert",
    entityId: row.id,
  });
  return { ok: true as const, alert: serializeAlert(updated) };
}

export async function assignHealthAlert(input: {
  actor: AdminActor;
  id: string;
  assignedUserId: string;
}) {
  const row = await prisma.organizationHealthAlert.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Alert not found." };
  const updated = await prisma.organizationHealthAlert.update({
    where: { id: row.id },
    data: {
      status: "ASSIGNED",
      assignedUserId: input.assignedUserId,
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "HEALTH_ALERT_ASSIGNED",
    entityType: "OrganizationHealthAlert",
    entityId: row.id,
    payload: { assignedUserId: input.assignedUserId },
  });
  return { ok: true as const, alert: serializeAlert(updated) };
}

export async function resolveHealthAlert(input: {
  actor: AdminActor;
  id: string;
  resolutionNote: string;
}) {
  if (!input.resolutionNote.trim()) {
    return { ok: false as const, error: "Resolution note is required." };
  }
  const row = await prisma.organizationHealthAlert.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Alert not found." };
  const updated = await prisma.organizationHealthAlert.update({
    where: { id: row.id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: input.actor.userId,
      resolutionNote: input.resolutionNote.trim().slice(0, 2000),
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "HEALTH_ALERT_RESOLVED",
    entityType: "OrganizationHealthAlert",
    entityId: row.id,
  });
  return { ok: true as const, alert: serializeAlert(updated) };
}

export async function dismissHealthAlert(input: {
  actor: AdminActor;
  id: string;
  reason: string;
}) {
  if (!input.reason.trim()) {
    return { ok: false as const, error: "Dismiss reason is required." };
  }
  const row = await prisma.organizationHealthAlert.findFirst({
    where: { id: input.id, organizationId: input.actor.organizationId },
  });
  if (!row) return { ok: false as const, error: "Alert not found." };
  const updated = await prisma.organizationHealthAlert.update({
    where: { id: row.id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissedByUserId: input.actor.userId,
      resolutionNote: input.reason.trim().slice(0, 2000),
    },
  });
  await writeAdminAudit({
    organizationId: input.actor.organizationId,
    actorId: input.actor.userId,
    action: "HEALTH_ALERT_DISMISSED",
    entityType: "OrganizationHealthAlert",
    entityId: row.id,
  });
  return { ok: true as const, alert: serializeAlert(updated) };
}

export function serializeAlert(row: {
  id: string;
  alertKey: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  evidence: string | null;
  sourceType: string | null;
  sourceRecordId: string | null;
  status: string;
  assignedUserId: string | null;
  detectedAt: Date;
  dueAt: Date | null;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  recommendedAction: string | null;
}) {
  return {
    id: row.id,
    alertKey: row.alertKey,
    category: row.category,
    severity: row.severity,
    title: row.title,
    description: row.description,
    evidence: row.evidence,
    sourceType: row.sourceType,
    sourceRecordId: row.sourceRecordId,
    status: row.status,
    assignedUserId: row.assignedUserId,
    detectedAt: row.detectedAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    recommendedAction: row.recommendedAction,
  };
}
