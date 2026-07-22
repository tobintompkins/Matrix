/**
 * Patch 50B — Organization Health orchestration (summary, snapshot, trends, export).
 */

import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { toCsv } from "@/lib/admin/completion/csv";
import { prisma } from "@/lib/db/prisma";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";
import {
  computeOverallHealthScore,
  HEALTH_CALCULATION_VERSION,
  safePercentChange,
  type HealthCategoryKey,
} from "./score";
import { getOrganizationHealthSettings } from "./settings";
import { collectCategoryInputs } from "./metrics";
import {
  listOrganizationHealthAlerts,
  serializeAlert,
  syncOrganizationHealthAlerts,
} from "./alerts";

const CATEGORY_PERM: Record<HealthCategoryKey, MatrixPermission> = {
  fleet: "VIEW_FLEET_HEALTH",
  service: "VIEW_SERVICE_HEALTH",
  pm: "VIEW_PM_HEALTH",
  inventory: "VIEW_INVENTORY_HEALTH",
  technician: "VIEW_TECHNICIAN_PRODUCTIVITY",
  customer: "VIEW_CUSTOMER_HEALTH",
  financial: "VIEW_FINANCIAL_HEALTH",
  security: "VIEW_ORGANIZATION_HEALTH",
};

export async function getOrganizationHealthSummary(actor: AdminActor) {
  const settings = await getOrganizationHealthSettings(actor.organizationId);
  if (!settings.enabled) {
    return {
      ok: true as const,
      enabled: false,
      message: "Organization Health is disabled for this organization.",
    };
  }

  const collected = await collectCategoryInputs(actor, settings);
  const score = computeOverallHealthScore(collected.inputs, settings);

  // Filter categories by permission
  const categories = score.categories.filter((c) =>
    hasMatrixPermission(actor.role, CATEGORY_PERM[c.key]),
  );

  let alerts: ReturnType<typeof serializeAlert>[] = [];
  if (hasMatrixPermission(actor.role, "VIEW_PREDICTIVE_ALERTS")) {
    const rows = await syncOrganizationHealthAlerts({
      actor,
      settings,
      kpis: collected.kpis,
    });
    alerts = rows
      .filter((a) => ["OPEN", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS"].includes(a.status))
      .slice(0, 50)
      .map(serializeAlert);
  }

  const previous = await prisma.organizationHealthSnapshot.findFirst({
    where: { organizationId: actor.organizationId },
    orderBy: { snapshotDate: "desc" },
  });
  const scoreChange =
    score.overallScore != null && previous?.overallScore != null
      ? safePercentChange(score.overallScore, previous.overallScore)
      : { absolute: null, percent: null, label: "No Previous Data" };

  const executiveKpis = [
    {
      key: "overall",
      label: "Overall Health Score",
      current: score.overallScore,
      previous: previous?.overallScore ?? null,
      target: 85,
      status: score.classification,
      changeLabel: safePercentChange(score.overallScore ?? 0, previous?.overallScore).label,
      absolute: safePercentChange(score.overallScore ?? 0, previous?.overallScore).absolute,
      percent: safePercentChange(score.overallScore ?? 0, previous?.overallScore).percent,
      dataPeriod: collected.freshness,
    },
    {
      key: "fleetAvailability",
      label: "Fleet Availability",
      current: collected.kpis.fleetAvailability,
      previous: null,
      target: settings.fleetAvailabilityWatchBelow,
      status:
        typeof collected.kpis.fleetAvailability === "number" &&
        collected.kpis.fleetAvailability < settings.fleetAvailabilityWatchBelow
          ? "Watch"
          : "Healthy",
      absolute: null as number | null,
      percent: null as number | null,
      changeLabel: "No Previous Data",
      dataPeriod: collected.freshness,
    },
    {
      key: "criticalCalls",
      label: "Open Critical Calls",
      current: collected.kpis.criticalOpenCalls,
      previous: null,
      target: 0,
      status:
        Number(collected.kpis.criticalOpenCalls) > 0 ? "At Risk" : "Healthy",
      absolute: null as number | null,
      percent: null as number | null,
      changeLabel: "No Previous Data",
      dataPeriod: collected.freshness,
    },
    {
      key: "pmCompliance",
      label: "PM Compliance",
      current: collected.kpis.pmCompliance,
      previous: null,
      target: settings.pmComplianceWatchBelow,
      status:
        typeof collected.kpis.pmCompliance === "number" &&
        collected.kpis.pmCompliance < settings.pmComplianceWatchBelow
          ? "Watch"
          : collected.kpis.pmCompliance == null
            ? "Not Available"
            : "Healthy",
      absolute: null as number | null,
      percent: null as number | null,
      changeLabel: "No Previous Data",
      dataPeriod: collected.freshness,
    },
    {
      key: "pendingApprovals",
      label: "Pending Critical Approvals",
      current: collected.kpis.criticalApprovals,
      previous: null,
      target: 0,
      status:
        Number(collected.kpis.overdueApprovals) > 0 ? "Critical" : "Healthy",
      absolute: null as number | null,
      percent: null as number | null,
      changeLabel: "No Previous Data",
      dataPeriod: collected.freshness,
    },
    {
      key: "customerRisk",
      label: "Customer Risk Count",
      current: collected.kpis.atRiskCustomers,
      previous: null,
      target: 0,
      status:
        Number(collected.kpis.atRiskCustomers) > 0 ? "Watch" : "Healthy",
      absolute: null as number | null,
      percent: null as number | null,
      changeLabel: "No Previous Data",
      dataPeriod: collected.freshness,
    },
  ];

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "ORGANIZATION_HEALTH_VIEWED",
    entityType: "OrganizationHealth",
    entityId: actor.organizationId,
  });

  return {
    ok: true as const,
    enabled: true,
    score: {
      ...score,
      categories,
      scoreChange,
    },
    kpis: collected.kpis,
    executiveKpis,
    alerts,
    approvalMetrics: collected.approvalMetrics,
    portalMetrics: collected.portalMetrics,
    freshness: collected.freshness,
    actionCenter: {
      criticalActions: alerts.filter((a) => a.severity === "CRITICAL"),
      approvalsBlocking: {
        pending: collected.approvalMetrics.pendingApprovals,
        overdue: collected.approvalMetrics.overdueApprovals,
        critical: collected.approvalMetrics.criticalApprovals,
        href: "/admin/approvals?overdueOnly=1",
      },
      serviceRisks: Number(collected.kpis.criticalOpenCalls),
      pmRisks:
        typeof collected.kpis.pmCompliance === "number" &&
        collected.kpis.pmCompliance < settings.pmComplianceWatchBelow
          ? 1
          : 0,
      inventoryRisks: Number(collected.kpis.inventoryOutOfStock),
      customerRisks: Number(collected.kpis.atRiskCustomers),
    },
    links: {
      approvals: "/admin/approvals",
      portalAdmin: "/admin/portal",
      fleet: "/admin/organization-health/fleet",
      service: "/admin/organization-health/service",
      pm: "/admin/organization-health/pm",
      inventory: "/admin/organization-health/inventory",
      technicians: "/admin/organization-health/technicians",
      customers: "/admin/organization-health/customers",
      alerts: "/admin/organization-health/alerts",
      settings: "/admin/organization-health/settings",
      dataQuality: "/admin/data-quality",
      systemLogs: "/admin/system-logs",
    },
    dataQuality: await (async () => {
      try {
        const { getDataQualityAggregateForOrgHealth } = await import(
          "@/lib/data-quality/summary"
        );
        return await getDataQualityAggregateForOrgHealth(actor.organizationId);
      } catch {
        return {
          enabled: false,
          dataHealthScore: null,
          openCriticalIssues: 0,
          duplicateRecordCount: 0,
          missingRequiredCount: 0,
          orphanedRecordCount: 0,
          href: "/admin/data-quality",
        };
      }
    })(),
    systemLogs: await (async () => {
      try {
        const { getSystemLogsAggregateForOrgHealth } = await import(
          "@/lib/system-logs/summary"
        );
        return await getSystemLogsAggregateForOrgHealth(actor.organizationId);
      } catch {
        return {
          enabled: false,
          criticalSecurityEvents: 0,
          unresolvedCriticalEvents: 0,
          apiErrorCountToday: 0,
          applicationErrorCountToday: 0,
          href: "/admin/system-logs",
        };
      }
    })(),
  };
}

export async function getOrganizationHealthDrilldown(
  actor: AdminActor,
  category: HealthCategoryKey | "alerts",
) {
  const settings = await getOrganizationHealthSettings(actor.organizationId);
  const collected = await collectCategoryInputs(actor, settings);
  if (category === "alerts") {
    if (!hasMatrixPermission(actor.role, "VIEW_PREDICTIVE_ALERTS")) {
      return { ok: false as const, error: "Forbidden" };
    }
    const rows = await listOrganizationHealthAlerts(actor.organizationId);
    return {
      ok: true as const,
      category,
      freshness: collected.freshness,
      items: rows.map(serializeAlert),
    };
  }
  if (!hasMatrixPermission(actor.role, CATEGORY_PERM[category])) {
    return { ok: false as const, error: "Forbidden" };
  }
  return {
    ok: true as const,
    category,
    freshness: collected.freshness,
    kpis: collected.kpis,
    items: normalizeDrilldownItems(collected.drilldowns[category]),
  };
}

function normalizeDrilldownItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
      metric: key,
      value,
    }));
  }
  return [];
}

export async function getOrganizationHealthTrends(actor: AdminActor, days = 30) {
  const safeDays = Math.min(365, Math.max(7, days));
  const since = new Date();
  since.setDate(since.getDate() - safeDays);
  const rows = await prisma.organizationHealthSnapshot.findMany({
    where: {
      organizationId: actor.organizationId,
      snapshotDate: { gte: since },
    },
    orderBy: { snapshotDate: "asc" },
  });
  if (rows.length === 0) {
    return {
      ok: true as const,
      rangeDays: safeDays,
      points: [] as Array<{
        date: string;
        overallScore: number | null;
        fleetScore: number | null;
        serviceScore: number | null;
        pmScore: number | null;
      }>,
      note: "Insufficient Data — no snapshots yet. Use Create Snapshot to begin trend history. Automatic daily snapshots are not claimed until a scheduler is configured.",
    };
  }
  return {
    ok: true as const,
    rangeDays: safeDays,
    points: rows.map((r) => ({
      date: r.snapshotDate.toISOString().slice(0, 10),
      overallScore: r.overallScore,
      fleetScore: r.fleetScore,
      serviceScore: r.serviceScore,
      pmScore: r.pmScore,
    })),
    note: null as string | null,
  };
}

export async function createOrganizationHealthSnapshot(actor: AdminActor) {
  const settings = await getOrganizationHealthSettings(actor.organizationId);
  const collected = await collectCategoryInputs(actor, settings);
  const score = computeOverallHealthScore(collected.inputs, settings);
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const byKey = Object.fromEntries(
    score.categories.map((c) => [c.key, c.score]),
  ) as Record<HealthCategoryKey, number | null>;

  const row = await prisma.organizationHealthSnapshot.upsert({
    where: {
      organizationId_snapshotDate: {
        organizationId: actor.organizationId,
        snapshotDate: day,
      },
    },
    create: {
      organizationId: actor.organizationId,
      snapshotDate: day,
      overallScore: score.overallScore,
      classification: score.classification,
      fleetScore: byKey.fleet,
      serviceScore: byKey.service,
      pmScore: byKey.pm,
      inventoryScore: byKey.inventory,
      technicianScore: byKey.technician,
      customerScore: byKey.customer,
      financialScore: byKey.financial,
      securityScore: byKey.security,
      metricSummary: JSON.stringify({
        kpis: collected.kpis,
        approvalMetrics: collected.approvalMetrics,
        portalMetrics: collected.portalMetrics,
      }),
      calculationVersion: HEALTH_CALCULATION_VERSION,
    },
    update: {
      overallScore: score.overallScore,
      classification: score.classification,
      fleetScore: byKey.fleet,
      serviceScore: byKey.service,
      pmScore: byKey.pm,
      inventoryScore: byKey.inventory,
      technicianScore: byKey.technician,
      customerScore: byKey.customer,
      financialScore: byKey.financial,
      securityScore: byKey.security,
      metricSummary: JSON.stringify({
        kpis: collected.kpis,
        approvalMetrics: collected.approvalMetrics,
        portalMetrics: collected.portalMetrics,
      }),
      calculationVersion: HEALTH_CALCULATION_VERSION,
    },
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "HEALTH_SNAPSHOT_CREATED",
    entityType: "OrganizationHealthSnapshot",
    entityId: row.id,
  });

  return { ok: true as const, snapshotId: row.id, date: day.toISOString() };
}

export async function exportOrganizationHealthCsv(actor: AdminActor) {
  const summary = await getOrganizationHealthSummary(actor);
  if (!summary.ok || !summary.enabled || !summary.score) {
    return { ok: false as const, error: "Export unavailable." };
  }
  const score = summary.score;
  const headers = [
    "Category",
    "Score",
    "Classification",
    "Weight",
    "Contribution",
    "Data Source",
  ];
  const rows = score.categories.map((c) => [
    c.key,
    c.score,
    c.classification,
    c.weight,
    c.weightedContribution,
    c.dataSource ?? "",
  ]);
  rows.unshift([
    "OVERALL",
    score.overallScore,
    score.classification,
    100,
    score.overallScore,
    summary.freshness ?? "",
  ]);
  const csv = toCsv(headers, rows);
  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "ORGANIZATION_HEALTH_EXPORTED",
    entityType: "OrganizationHealth",
    entityId: actor.organizationId,
  });
  return { ok: true as const, csv, filename: `organization-health-${new Date().toISOString().slice(0, 10)}.csv` };
}
