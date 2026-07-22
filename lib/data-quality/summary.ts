/**
 * Patch 50C-1 — Dashboard summary, score, trends, snapshots, Org Health aggregate.
 */

import type { AdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { prisma } from "@/lib/db/prisma";
import {
  classifyDataHealth,
  computeDataHealthScore,
  DATA_QUALITY_CALC_VERSION,
  type DataQualityModule,
  type DimensionScoreInput,
} from "./score";
import { getDataQualitySettings } from "./settings";
import { ensureSystemRulesSeeded } from "./rules";

const OPEN_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_REVIEW",
  "FIX_PENDING",
  "REOPENED",
] as const;

function scoreFromIssueCounts(open: number, critical: number): number {
  const raw = 100 - critical * 12 - Math.max(0, open - critical) * 4;
  return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
}

function mapModuleToDimension(
  module: string,
): DimensionScoreInput["dimension"] | null {
  switch (module) {
    case "customers":
    case "contacts":
    case "locations":
    case "machines":
    case "parts":
      return "completeness";
    case "serviceCalls":
    case "pm":
    case "meters":
    case "inventory":
      return "validity";
    case "portal":
    case "approvals":
    case "users":
      return "relationshipIntegrity";
    case "partsOrders":
      return "timeliness";
    default:
      return null;
  }
}

export async function getDataQualityAggregateForOrgHealth(
  organizationId: string,
) {
  const settings = await getDataQualitySettings(organizationId);
  if (!settings.enabled) {
    return {
      enabled: false,
      dataHealthScore: null as number | null,
      openCriticalIssues: 0,
      duplicateRecordCount: 0,
      missingRequiredCount: 0,
      orphanedRecordCount: 0,
      href: "/admin/data-quality",
    };
  }
  const openWhere = {
    organizationId,
    status: { in: [...OPEN_STATUSES] },
  };
  const [
    openCritical,
    duplicates,
    missing,
    orphaned,
    openTotal,
  ] = await Promise.all([
    prisma.dataQualityIssue.count({
      where: { ...openWhere, severity: "CRITICAL" },
    }),
    prisma.dataQualityIssue.count({
      where: {
        ...openWhere,
        issueType: { in: ["DUPLICATE", "POSSIBLE_MERGE"] },
      },
    }),
    prisma.dataQualityIssue.count({
      where: { ...openWhere, issueType: "MISSING_REQUIRED_VALUE" },
    }),
    prisma.dataQualityIssue.count({
      where: {
        ...openWhere,
        issueType: { in: ["ORPHANED_RECORD", "BROKEN_RELATIONSHIP"] },
      },
    }),
    prisma.dataQualityIssue.count({ where: openWhere }),
  ]);
  const dataHealthScore = scoreFromIssueCounts(openTotal, openCritical);
  return {
    enabled: true,
    dataHealthScore,
    classification: classifyDataHealth(dataHealthScore, settings),
    openCriticalIssues: openCritical,
    duplicateRecordCount: duplicates,
    missingRequiredCount: missing,
    orphanedRecordCount: orphaned,
    openIssueCount: openTotal,
    href: "/admin/data-quality",
  };
}

export async function calculateDataQualityScore(organizationId: string) {
  const settings = await getDataQualitySettings(organizationId);
  const openIssues = await prisma.dataQualityIssue.findMany({
    where: { organizationId, status: { in: [...OPEN_STATUSES] } },
    select: { module: true, severity: true, issueType: true },
  });

  const modules = new Map<
    string,
    { open: number; critical: number }
  >();
  const byDimension = new Map<
    DimensionScoreInput["dimension"],
    { open: number; critical: number }
  >();
  const uniquenessOpen = openIssues.filter((i) =>
    ["DUPLICATE", "POSSIBLE_MERGE"].includes(i.issueType),
  ).length;
  const uniquenessCritical = openIssues.filter(
    (i) =>
      ["DUPLICATE", "POSSIBLE_MERGE"].includes(i.issueType) &&
      i.severity === "CRITICAL",
  ).length;

  for (const issue of openIssues) {
    const m = modules.get(issue.module) ?? { open: 0, critical: 0 };
    m.open += 1;
    if (issue.severity === "CRITICAL") m.critical += 1;
    modules.set(issue.module, m);
    const dim = mapModuleToDimension(issue.module);
    if (dim) {
      const d = byDimension.get(dim) ?? { open: 0, critical: 0 };
      d.open += 1;
      if (issue.severity === "CRITICAL") d.critical += 1;
      byDimension.set(dim, d);
    }
  }

  const dimensionInputs: DimensionScoreInput[] = [
    {
      dimension: "completeness",
      ...(byDimension.get("completeness")
        ? {
            available: true,
            score: scoreFromIssueCounts(
              byDimension.get("completeness")!.open,
              byDimension.get("completeness")!.critical,
            ),
            openIssues: byDimension.get("completeness")!.open,
            criticalIssues: byDimension.get("completeness")!.critical,
          }
        : openIssues.length === 0
          ? {
              available: true,
              score: 100,
              openIssues: 0,
              criticalIssues: 0,
              notes: ["No open completeness findings after last scan."],
            }
          : {
              available: true,
              score: 100,
              openIssues: 0,
              criticalIssues: 0,
            }),
    },
    {
      dimension: "validity",
      available: true,
      score: scoreFromIssueCounts(
        byDimension.get("validity")?.open ?? 0,
        byDimension.get("validity")?.critical ?? 0,
      ),
      openIssues: byDimension.get("validity")?.open ?? 0,
      criticalIssues: byDimension.get("validity")?.critical ?? 0,
    },
    {
      dimension: "uniqueness",
      available: true,
      score: scoreFromIssueCounts(uniquenessOpen, uniquenessCritical),
      openIssues: uniquenessOpen,
      criticalIssues: uniquenessCritical,
    },
    {
      dimension: "relationshipIntegrity",
      available: true,
      score: scoreFromIssueCounts(
        byDimension.get("relationshipIntegrity")?.open ?? 0,
        byDimension.get("relationshipIntegrity")?.critical ?? 0,
      ),
      openIssues: byDimension.get("relationshipIntegrity")?.open ?? 0,
      criticalIssues: byDimension.get("relationshipIntegrity")?.critical ?? 0,
    },
    {
      dimension: "timeliness",
      available: true,
      score: scoreFromIssueCounts(
        byDimension.get("timeliness")?.open ?? 0,
        byDimension.get("timeliness")?.critical ?? 0,
      ),
      openIssues: byDimension.get("timeliness")?.open ?? 0,
      criticalIssues: byDimension.get("timeliness")?.critical ?? 0,
    },
  ];

  const score = computeDataHealthScore(dimensionInputs, settings);
  const moduleScores = [...modules.entries()].map(([module, counts]) => ({
    module: module as DataQualityModule,
    score: scoreFromIssueCounts(counts.open, counts.critical),
    classification: classifyDataHealth(
      scoreFromIssueCounts(counts.open, counts.critical),
      settings,
    ),
    openIssueCount: counts.open,
    criticalIssueCount: counts.critical,
  }));

  const previous = await prisma.dataQualitySnapshot.findFirst({
    where: { organizationId },
    orderBy: { snapshotDate: "desc" },
  });

  return {
    ...score,
    previousScore: previous?.overallScore ?? null,
    trend:
      score.overallScore != null && previous?.overallScore != null
        ? Math.round((score.overallScore - previous.overallScore) * 100) / 100
        : null,
    moduleScores,
    openIssueCount: openIssues.length,
    criticalIssueCount: openIssues.filter((i) => i.severity === "CRITICAL")
      .length,
    settings: {
      weights: settings.dimensionWeights,
      automaticScanEnabled: settings.automaticScanEnabled,
      schedulerAvailable: false,
    },
  };
}

export async function getDataQualitySummary(actor: AdminActor) {
  await ensureSystemRulesSeeded(actor.organizationId);
  const settings = await getDataQualitySettings(actor.organizationId);
  if (!settings.enabled) {
    return {
      ok: true as const,
      enabled: false,
      message: "Data Quality Center is disabled.",
    };
  }

  const orgId = actor.organizationId;
  const openWhere = { organizationId: orgId, status: { in: [...OPEN_STATUSES] } };
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [
    score,
    openIssues,
    criticalIssues,
    highIssues,
    newIssues,
    assignedIssues,
    overdueIssues,
    resolvedThisMonth,
    duplicates,
    missing,
    invalid,
    orphaned,
    lastScan,
    recentDetections,
    recentlyResolved,
    assignedToMe,
  ] = await Promise.all([
    calculateDataQualityScore(orgId),
    prisma.dataQualityIssue.count({ where: openWhere }),
    prisma.dataQualityIssue.count({
      where: { ...openWhere, severity: "CRITICAL" },
    }),
    prisma.dataQualityIssue.count({
      where: { ...openWhere, severity: "HIGH" },
    }),
    prisma.dataQualityIssue.count({
      where: { ...openWhere, firstDetectedAt: { gte: weekAgo } },
    }),
    prisma.dataQualityIssue.count({
      where: { ...openWhere, status: "ASSIGNED" },
    }),
    prisma.dataQualityIssue.count({
      where: {
        ...openWhere,
        dueAt: { lt: now },
      },
    }),
    prisma.dataQualityIssue.count({
      where: {
        organizationId: orgId,
        status: "RESOLVED",
        resolvedAt: { gte: monthStart },
      },
    }),
    prisma.dataQualityIssue.count({
      where: {
        ...openWhere,
        issueType: { in: ["DUPLICATE", "POSSIBLE_MERGE"] },
      },
    }),
    prisma.dataQualityIssue.count({
      where: { ...openWhere, issueType: "MISSING_REQUIRED_VALUE" },
    }),
    prisma.dataQualityIssue.count({
      where: {
        ...openWhere,
        issueType: { in: ["INVALID_VALUE", "FORMAT_ERROR", "OUTLIER"] },
      },
    }),
    prisma.dataQualityIssue.count({
      where: {
        ...openWhere,
        issueType: { in: ["ORPHANED_RECORD", "BROKEN_RELATIONSHIP"] },
      },
    }),
    prisma.dataQualityScan.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dataQualityIssue.findMany({
      where: { organizationId: orgId },
      orderBy: { lastDetectedAt: "desc" },
      take: 8,
    }),
    prisma.dataQualityIssue.findMany({
      where: { organizationId: orgId, status: "RESOLVED" },
      orderBy: { resolvedAt: "desc" },
      take: 8,
    }),
    prisma.dataQualityIssue.findMany({
      where: {
        ...openWhere,
        assignedToUserId: actor.userId,
      },
      orderBy: { lastDetectedAt: "desc" },
      take: 8,
    }),
  ]);

  const bySeverity = await prisma.dataQualityIssue.groupBy({
    by: ["severity"],
    where: openWhere,
    _count: { _all: true },
  });
  const byType = await prisma.dataQualityIssue.groupBy({
    by: ["issueType"],
    where: openWhere,
    _count: { _all: true },
  });
  const byModule = await prisma.dataQualityIssue.groupBy({
    by: ["module"],
    where: openWhere,
    _count: { _all: true },
  });

  await writeAdminAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: "DATA_QUALITY_CENTER_VIEWED",
    entityType: "DataQualityCenter",
    entityId: orgId,
  });

  return {
    ok: true as const,
    enabled: true,
    score,
    cards: {
      overallDataHealthScore: score.overallScore,
      classification: score.classification,
      openDataIssues: openIssues,
      criticalIssues,
      highPriorityIssues: highIssues,
      newIssues,
      assignedIssues,
      overdueIssues,
      resolvedThisMonth,
      duplicateCandidates: duplicates,
      missingRequiredFields: missing,
      invalidRecords: invalid,
      orphanedRecords: orphaned,
      lastScan: lastScan
        ? {
            id: lastScan.id,
            status: lastScan.status,
            completedAt: lastScan.completedAt?.toISOString() ?? null,
            issuesFound: lastScan.issuesFound,
          }
        : null,
      nextScheduledScan: settings.automaticScanEnabled
        ? "Scheduler unavailable — automatic scans are not active"
        : "Not scheduled (manual scans only)",
    },
    charts: {
      bySeverity: bySeverity.map((r) => ({
        key: r.severity,
        count: r._count._all,
      })),
      byType: byType.map((r) => ({ key: r.issueType, count: r._count._all })),
      byModule: byModule.map((r) => ({ key: r.module, count: r._count._all })),
    },
    recentDetections: recentDetections.map(serializeLiteIssue),
    recentlyResolved: recentlyResolved.map(serializeLiteIssue),
    assignedToMe: assignedToMe.map(serializeLiteIssue),
    moduleScores: score.moduleScores,
    quickActions: [
      { label: "Run Data Scan", href: "/admin/data-quality/scans", action: "scan" },
      {
        label: "Review Critical Issues",
        href: "/admin/data-quality/issues?severity=CRITICAL",
      },
      {
        label: "Review Duplicates",
        href: "/admin/data-quality/issues?issueType=DUPLICATE",
      },
      {
        label: "Review Missing Data",
        href: "/admin/data-quality/issues?issueType=MISSING_REQUIRED_VALUE",
      },
      {
        label: "Review Orphaned Records",
        href: "/admin/data-quality/issues?issueType=ORPHANED_RECORD",
      },
      { label: "Open Cleanup Wizard", href: "/admin/data-quality/issues?view=cleanup" },
      { label: "Export Report", href: "/api/data-quality/export?kind=summary" },
      { label: "Manage Rules", href: "/admin/data-quality/rules" },
      { label: "Merge Wizard", href: "/admin/data-quality/merge" },
    ],
    links: {
      issues: "/admin/data-quality/issues",
      rules: "/admin/data-quality/rules",
      scans: "/admin/data-quality/scans",
      merge: "/admin/data-quality/merge",
      settings: "/admin/data-quality/settings",
      organizationHealth: "/admin/organization-health",
    },
    settingsNote: settings.automaticScanEnabled
      ? "Automatic scan is enabled in settings but no background scheduler is available in this environment."
      : null,
  };
}

function serializeLiteIssue(row: {
  id: string;
  title: string;
  severity: string;
  status: string;
  module: string;
  issueType: string;
  entityType: string;
  entityId: string;
  lastDetectedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    severity: row.severity,
    status: row.status,
    module: row.module,
    issueType: row.issueType,
    entityType: row.entityType,
    entityId: row.entityId,
    lastDetectedAt: row.lastDetectedAt.toISOString(),
  };
}

export async function createDataQualitySnapshot(actor: AdminActor) {
  const score = await calculateDataQualityScore(actor.organizationId);
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const issueCounts = {
    open: score.openIssueCount,
    critical: score.criticalIssueCount,
  };
  const row = await prisma.dataQualitySnapshot.upsert({
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
      moduleScoresJson: JSON.stringify(score.moduleScores),
      issueCountsJson: JSON.stringify(issueCounts),
      calculationVersion: DATA_QUALITY_CALC_VERSION,
    },
    update: {
      overallScore: score.overallScore,
      classification: score.classification,
      moduleScoresJson: JSON.stringify(score.moduleScores),
      issueCountsJson: JSON.stringify(issueCounts),
      calculationVersion: DATA_QUALITY_CALC_VERSION,
    },
  });
  return { ok: true as const, snapshotId: row.id, score: score.overallScore };
}

export async function getDataQualityTrends(
  organizationId: string,
  days = 30,
) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snapshots = await prisma.dataQualitySnapshot.findMany({
    where: { organizationId, snapshotDate: { gte: since } },
    orderBy: { snapshotDate: "asc" },
  });
  const openIssues = await prisma.dataQualityIssue.findMany({
    where: {
      organizationId,
      firstDetectedAt: { gte: since },
    },
    select: { firstDetectedAt: true, severity: true, issueType: true, status: true },
  });
  return {
    points: snapshots.map((s) => ({
      date: s.snapshotDate.toISOString().slice(0, 10),
      overallScore: s.overallScore,
      classification: s.classification,
    })),
    detections: openIssues.length,
    note:
      snapshots.length === 0
        ? "No historical snapshots yet. Create a snapshot from the dashboard or run Create Snapshot."
        : null,
  };
}
