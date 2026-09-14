/**
 * Patch 51A.5 Part 3 Completion — Executive Action Center.
 * Consolidates risks from existing Matrix modules (service, PM, inventory,
 * predictive, decisions) into one inbox — not a second alert engine.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { listBalances, getDashboardMetrics } from "@/lib/inventory";
import { writeAdminAudit } from "@/lib/admin/repository";

export type ExecutiveAlertSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFO";

type Candidate = {
  alertKey: string;
  category: string;
  severity: ExecutiveAlertSeverity;
  title: string;
  explanation: string;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
  href?: string;
  recommendedAction?: string;
  sourceType?: string;
  sourceRecordId?: string;
};

function collectCandidates(): Candidate[] {
  const out: Candidate[] = [];
  const calls = listServiceCalls({ includeDeleted: false });
  const open = calls.filter((c) => isOpenServiceCallStatus(c.status));
  const critical = open.filter(
    (c) =>
      c.priority === "CRITICAL" ||
      c.priority === "EMERGENCY" ||
      c.problem.machineCurrentlyDown,
  );
  if (critical.length > 0) {
    out.push({
      alertKey: "critical-open-calls",
      category: "service",
      severity: critical.length >= 5 ? "CRITICAL" : "HIGH",
      title: "Critical open service calls",
      explanation: `${critical.length} critical/emergency or machine-down calls are open.`,
      href: "/service-calls?status=OPEN&priority=CRITICAL",
      recommendedAction: "Assign owners and clear critical queue.",
      sourceType: "ServiceCalls",
    });
  }

  const aging = open.filter(
    (c) => Date.now() - new Date(c.createdAt).getTime() > 48 * 3_600_000,
  );
  if (aging.length > 0) {
    out.push({
      alertKey: "aging-open-calls",
      category: "service",
      severity: aging.length >= 10 ? "HIGH" : "MEDIUM",
      title: "Aging open service calls",
      explanation: `${aging.length} open call(s) older than 48 hours.`,
      href: "/service-calls?status=OPEN",
      recommendedAction: "Review aging queue and escalate stuck work.",
      sourceType: "ServiceCalls",
    });
  }

  const byMachine = new Map<string, number>();
  for (const c of calls.filter(
    (x) => Date.now() - new Date(x.createdAt).getTime() < 90 * 86_400_000,
  )) {
    byMachine.set(
      c.machine.machineId,
      (byMachine.get(c.machine.machineId) ?? 0) + 1,
    );
  }
  const repeats = [...byMachine.entries()].filter(([, n]) => n >= 3);
  if (repeats.length > 0) {
    const top = repeats.sort((a, b) => b[1] - a[1])[0]!;
    out.push({
      alertKey: "repeat-failures",
      category: "fleet",
      severity: "HIGH",
      title: "Repeat service failures",
      explanation: `${repeats.length} machine(s) have ≥3 calls in 90 days. Top: ${top[0]} (${top[1]}).`,
      entityType: "Machine",
      entityId: top[0],
      entityLabel: top[0],
      href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(top[0])}`,
      recommendedAction: "Open machine history and predictive health.",
      sourceType: "ServiceCalls",
      sourceRecordId: top[0],
    });
  }

  try {
    const metrics = getDashboardMetrics();
    if ((metrics.outOfStock ?? 0) > 0) {
      out.push({
        alertKey: "inventory-stockout",
        category: "inventory",
        severity: (metrics.outOfStock ?? 0) >= 10 ? "CRITICAL" : "HIGH",
        title: "Stockout risk",
        explanation: `${metrics.outOfStock} part(s) are out of stock.`,
        href: "/inventory?filter=outOfStock",
        recommendedAction: "Create or approve parts orders for stockouts.",
        sourceType: "Inventory",
      });
    }
    if ((metrics.lowStock ?? 0) > 0) {
      out.push({
        alertKey: "inventory-low-stock",
        category: "inventory",
        severity: "MEDIUM",
        title: "Low-stock parts",
        explanation: `${metrics.lowStock} part(s) are at or below reorder point.`,
        href: "/inventory?filter=lowStock",
        recommendedAction: "Review reorder recommendations.",
        sourceType: "Inventory",
      });
    }
  } catch {
    /* inventory optional */
  }

  try {
    const low = listBalances().filter((b) => b.quantityOnHand <= 0).slice(0, 1);
    if (low[0]) {
      out.push({
        alertKey: `stockout-${low[0].partId}`,
        category: "inventory",
        severity: "HIGH",
        title: `Stockout: ${low[0].partId}`,
        explanation: `Part ${low[0].partId} has zero on-hand at ${low[0].locationId}.`,
        entityType: "Part",
        entityId: low[0].partId,
        entityLabel: low[0].partId,
        href: "/inventory",
        recommendedAction: "Expedite replenishment for this part.",
        sourceType: "InventoryBalance",
        sourceRecordId: low[0].partId,
      });
    }
  } catch {
    /* optional */
  }

  return out;
}

export async function syncExecutiveAlerts(organizationId = DEFAULT_ORG_ID) {
  const candidates = collectCandidates();
  let upserted = 0;
  for (const c of candidates) {
    const existing = await prisma.executiveAlert.findFirst({
      where: {
        organizationId,
        alertKey: c.alertKey,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
    });
    if (existing) {
      await prisma.executiveAlert.update({
        where: { id: existing.id },
        data: {
          severity: c.severity,
          title: c.title,
          explanation: c.explanation,
          href: c.href,
          recommendedAction: c.recommendedAction,
          entityType: c.entityType,
          entityId: c.entityId,
          entityLabel: c.entityLabel,
          sourceType: c.sourceType,
          sourceRecordId: c.sourceRecordId,
        },
      });
    } else {
      await prisma.executiveAlert.create({
        data: {
          organizationId,
          alertKey: c.alertKey,
          category: c.category,
          severity: c.severity,
          title: c.title,
          explanation: c.explanation,
          entityType: c.entityType,
          entityId: c.entityId,
          entityLabel: c.entityLabel,
          href: c.href,
          recommendedAction: c.recommendedAction,
          sourceType: c.sourceType,
          sourceRecordId: c.sourceRecordId,
          status: "OPEN",
        },
      });
    }
    upserted += 1;
  }

  // Enrich from predictive + decision tables when present
  try {
    const pred = await prisma.predictiveRiskAlert.findMany({
      where: { organizationId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: { openedAt: "desc" },
      take: 25,
    });
    for (const a of pred) {
      const key = `predictive:${a.dedupeKey}`;
      const existing = await prisma.executiveAlert.findFirst({
        where: {
          organizationId,
          alertKey: key,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
      });
      const payload = {
        category: "predictive",
        severity: (["CRITICAL", "HIGH"].includes(a.severity)
          ? a.severity
          : a.severity === "WARNING"
            ? "MEDIUM"
            : "LOW") as ExecutiveAlertSeverity,
        title: a.title,
        explanation: a.message,
        entityType: "Machine",
        entityId: a.machineId,
        entityLabel: a.machineId,
        href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(a.machineId)}`,
        recommendedAction: "Review predictive maintenance recommendation.",
        sourceType: "PredictiveRiskAlert",
        sourceRecordId: a.id,
      };
      if (existing) {
        await prisma.executiveAlert.update({
          where: { id: existing.id },
          data: payload,
        });
      } else {
        await prisma.executiveAlert.create({
          data: {
            organizationId,
            alertKey: key,
            status: "OPEN",
            ...payload,
          },
        });
      }
      upserted += 1;
    }
  } catch {
    /* predictive optional */
  }

  try {
    const decisions = await prisma.decisionRecommendation.findMany({
      where: {
        organizationId,
        status: { in: ["NEW", "IN_REVIEW", "APPROVED", "ASSIGNED"] },
        priority: { in: ["CRITICAL", "HIGH"] },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    });
    for (const d of decisions) {
      const key = `decision:${d.id}`;
      const existing = await prisma.executiveAlert.findFirst({
        where: {
          organizationId,
          alertKey: key,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
      });
      if (existing) continue;
      await prisma.executiveAlert.create({
        data: {
          organizationId,
          alertKey: key,
          category: "decision",
          severity: d.priority === "CRITICAL" ? "CRITICAL" : "HIGH",
          title: d.title || "Decision Engine recommendation",
          explanation:
            d.summary || d.recommendedAction || "Open recommendation requires review.",
          href: `/ai-operations/decisions/${encodeURIComponent(d.id)}`,
          recommendedAction:
            d.recommendedAction ||
            "Review and approve or assign in Decision Center.",
          sourceType: "DecisionRecommendation",
          sourceRecordId: d.id,
          status: "OPEN",
        },
      });
      upserted += 1;
    }
  } catch {
    /* decisions optional */
  }

  // Patch 51C.1 — merge high-severity Organization Health alerts (dedupe by source id)
  try {
    const { isEnterpriseIntelligence51c1Enabled } = await import("./feature-flag");
    if (isEnterpriseIntelligence51c1Enabled()) {
      const { listOrgHealthBridgeAlerts } = await import("./org-health-bridge");
      const ohAlerts = await listOrgHealthBridgeAlerts(organizationId);
      for (const a of ohAlerts) {
        if (!["CRITICAL", "HIGH"].includes(a.severity)) continue;
        const key = `org-health:${a.id}`;
        const existing = await prisma.executiveAlert.findFirst({
          where: {
            organizationId,
            alertKey: key,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
          },
        });
        if (existing) continue;
        await prisma.executiveAlert.create({
          data: {
            organizationId,
            alertKey: key,
            category: "organization-health",
            severity: a.severity as ExecutiveAlertSeverity,
            title: a.title,
            explanation: `Organization Health alert (${a.status}).`,
            href: a.href,
            recommendedAction: "Review Organization Health alerts and assigned owners.",
            sourceType: "OrganizationHealthAlert",
            sourceRecordId: a.id,
            status: "OPEN",
          },
        });
        upserted += 1;
      }
    }
  } catch {
    /* org-health optional */
  }

  // Patch 51C.2 — Predictive Business Analytics alerts (dedupe by alertKey)
  try {
    const { collectPredictiveBusinessAlertCandidates } = await import(
      "./predictive-business/alerts"
    );
    const pba = await collectPredictiveBusinessAlertCandidates();
    for (const c of pba) {
      const existing = await prisma.executiveAlert.findFirst({
        where: {
          organizationId,
          alertKey: c.alertKey,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
      });
      if (existing) {
        await prisma.executiveAlert.update({
          where: { id: existing.id },
          data: {
            severity: c.severity,
            title: c.title,
            explanation: c.explanation,
            href: c.href,
            recommendedAction: c.recommendedAction,
            sourceType: c.sourceType,
            sourceRecordId: c.sourceRecordId,
          },
        });
      } else {
        await prisma.executiveAlert.create({
          data: {
            organizationId,
            alertKey: c.alertKey,
            category: c.category,
            severity: c.severity,
            title: c.title,
            explanation: c.explanation,
            href: c.href,
            recommendedAction: c.recommendedAction,
            sourceType: c.sourceType,
            sourceRecordId: c.sourceRecordId,
            status: "OPEN",
          },
        });
      }
      upserted += 1;
    }
  } catch {
    /* predictive business optional */
  }

  return { upserted, candidates: candidates.length };
}

export async function listExecutiveAlerts(input?: {
  organizationId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const page = Math.max(1, input?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 25));
  const where = {
    organizationId,
    ...(input?.status ? { status: input.status } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.executiveAlert.count({ where }),
    prisma.executiveAlert.findMany({
      where,
      orderBy: [{ severity: "asc" }, { detectedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  // Severity sort is lexical; re-rank in memory
  const rank: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };
  items.sort(
    (a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9),
  );
  return { items, total, page, pageSize };
}

export async function acknowledgeExecutiveAlert(input: {
  id: string;
  actorId: string;
  organizationId?: string;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const row = await prisma.executiveAlert.findFirst({
    where: { id: input.id, organizationId },
  });
  if (!row) return null;
  const updated = await prisma.executiveAlert.update({
    where: { id: row.id },
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedByUserId: input.actorId,
    },
  });
  await writeAdminAudit({
    organizationId,
    actorId: input.actorId,
    action: "EXECUTIVE_ALERT_ACKNOWLEDGED",
    entityType: "ExecutiveAlert",
    entityId: row.id,
    message: `Acknowledged: ${row.title}`,
    category: "AI_OPERATIONS",
    severity: "INFO",
    outcome: "SUCCESS",
  }).catch(() => undefined);
  return updated;
}

export async function resolveExecutiveAlert(input: {
  id: string;
  actorId: string;
  note?: string;
  dismiss?: boolean;
  organizationId?: string;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const row = await prisma.executiveAlert.findFirst({
    where: { id: input.id, organizationId },
  });
  if (!row) return null;
  const status = input.dismiss ? "DISMISSED" : "RESOLVED";
  const updated = await prisma.executiveAlert.update({
    where: { id: row.id },
    data: {
      status,
      resolvedAt: new Date(),
      resolvedByUserId: input.actorId,
      resolutionNote: input.note ?? null,
      ...(input.dismiss
        ? {}
        : {}),
    },
  });
  await writeAdminAudit({
    organizationId,
    actorId: input.actorId,
    action: input.dismiss
      ? "EXECUTIVE_ALERT_DISMISSED"
      : "EXECUTIVE_ALERT_RESOLVED",
    entityType: "ExecutiveAlert",
    entityId: row.id,
    message: `${status}: ${row.title}`,
    category: "AI_OPERATIONS",
    severity: "INFO",
    outcome: "SUCCESS",
  }).catch(() => undefined);
  return updated;
}
