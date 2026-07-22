/**
 * Patch 51A.1 Part 2 — Dashboard summary + trends from stored insights.
 */

import { prisma } from "@/lib/db/prisma";
import { aiConfig } from "@/config/ai";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { digitalTwinFleet } from "@/lib/digital-twin";
import { listServiceCalls } from "@/lib/service-calls";
import type {
  AiDashboardSummary,
  AiExecutiveBriefing,
  AiHealthState,
  AiOpsInsightDto,
} from "./insight-types";
import { mapInsight } from "./insight-workflow";
import { getActiveAnalysisRun } from "./analysis-runner";

const ADVISORY =
  "AI-generated insights are advisory and may be incomplete or inaccurate. Review supporting records before making operational decisions.";

function buildBriefing(
  insights: AiOpsInsightDto[],
  lastAnalysisAt: string | null,
): AiExecutiveBriefing {
  const active = insights.filter(
    (i) => !["RESOLVED", "DISMISSED", "ARCHIVED"].includes(i.status),
  );
  if (active.length === 0) {
    return {
      text: "Insufficient operational AI signal is currently available. Run an analysis after Matrix contains sufficient service, fleet, PM, and inventory activity.",
      overallCondition: "Insufficient data",
      mostUrgentRisk: "Not enough stored insights to identify an urgent risk.",
      mostImportantOpportunity: "Run AI analysis to establish a baseline.",
      highestPriorityAction: "Request a manual AI analysis from an administrator.",
      majorTrend: "No prior insight history in the selected window.",
      dataGaps: "Service, fleet, PM, or inventory coverage may be incomplete.",
      analyzedAt: lastAnalysisAt ?? new Date().toISOString(),
      confidence: 0,
      insufficientData: true,
    };
  }

  const critical = active
    .filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH")
    .sort((a, b) => b.confidence - a.confidence);
  const opportunity = active.find(
    (i) =>
      i.insightType === "OPERATIONAL_OPPORTUNITY" ||
      i.riskCategory === "PLAN_NEXT",
  );
  const avgConfidence =
    active.reduce((n, i) => n + i.confidence, 0) / Math.max(1, active.length);
  const top = critical[0] ?? active[0]!;
  const overall =
    critical.some((i) => i.severity === "CRITICAL")
      ? "Attention required"
      : critical.length > 0
        ? "Stable with elevated risks"
        : "Generally stable";

  const text = [
    `Matrix currently shows ${overall.toLowerCase()}.`,
    top
      ? `Highest priority: ${top.title} (${top.severity}, ${Math.round(top.confidence)}% confidence).`
      : "",
    opportunity
      ? `Opportunity: ${opportunity.summary}`
      : "No strong opportunity signal was ranked above monitoring items.",
    `Active advisory insights: ${active.length}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    text,
    overallCondition: overall,
    mostUrgentRisk: top.summary,
    mostImportantOpportunity: opportunity?.summary ?? "None ranked above monitoring.",
    highestPriorityAction: top.recommendedAction,
    majorTrend:
      critical.length > 0
        ? `${critical.length} high/critical insight(s) remain open.`
        : "Open insights are mostly medium/low severity.",
    dataGaps:
      "Insights are limited to currently loaded Matrix operational data and prior analysis runs.",
    analyzedAt: lastAnalysisAt ?? active[0]!.updatedAt,
    confidence: Math.round(avgConfidence),
    insufficientData: false,
  };
}

export async function getAiOperationsDashboard(
  organizationId = DEFAULT_ORG_ID,
): Promise<AiDashboardSummary> {
  const insights = await prisma.aiOpsInsight.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  const mapped = insights.map(mapInsight);
  const active = mapped.filter(
    (i) => !["RESOLVED", "DISMISSED", "ARCHIVED"].includes(i.status),
  );
  const critical = active.filter(
    (i) => i.severity === "CRITICAL" || i.severity === "HIGH",
  );
  const anomalies = active.filter((i) =>
    ["METER_ANOMALY", "PART_USAGE_ANOMALY", "DATA_QUALITY", "REPEAT_FAILURE"].includes(
      i.insightType,
    ),
  );
  const pending = active.filter((i) =>
    ["NEW", "REVIEWING", "ACTION_REQUIRED"].includes(i.status),
  );
  const dq = active.filter((i) => i.sourceModule === "DATA_QUALITY" || i.insightType === "DATA_QUALITY");

  const lastRun = await prisma.aiOpsAnalysisRun.findFirst({
    where: { organizationId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });
  const lastFailed = await prisma.aiOpsAnalysisRun.findFirst({
    where: { organizationId, status: "FAILED" },
    orderBy: { completedAt: "desc" },
  });
  void lastFailed;

  const avgConfidence =
    active.length === 0
      ? aiConfig.defaultConfidence
      : Math.round(
          active.reduce((n, i) => n + i.confidence, 0) / active.length,
        );

  const freshnessHours = lastRun?.completedAt
    ? (Date.now() - lastRun.completedAt.getTime()) / 36e5
    : null;
  const dataFreshness =
    freshnessHours == null
      ? "No completed analysis"
      : freshnessHours < 24
        ? "Fresh"
        : freshnessHours < 72
          ? "Aging"
          : "Stale";

  const customers = new Set(
    digitalTwinFleet.map((m) => m.location.customerName).filter(Boolean),
  );
  const calls = listServiceCalls({ includeDeleted: false });

  let inventoryRecordsAnalyzed = 0;
  try {
    const inv = await import("@/lib/inventory/enterprise-repository");
    inventoryRecordsAnalyzed = inv.listCatalog(undefined, 1, 500).items.length;
  } catch {
    /* optional */
  }

  return {
    serviceStatus: aiConfig.enabled ? "Online" : "Unavailable",
    lastSuccessfulAnalysisAt: lastRun?.completedAt?.toISOString() ?? null,
    activeInsights: active.length,
    criticalRecommendations: critical.length,
    unresolvedAnomalies: anomalies.length,
    pendingHumanReviews: pending.length,
    dataFreshness,
    averageConfidence: avgConfidence,
    dataQualityWarnings: dq.length,
    coverage: {
      machinesAnalyzed: digitalTwinFleet.length,
      customersAnalyzed: customers.size,
      serviceCallsAnalyzed: calls.length,
      pmRecordsAnalyzed: digitalTwinFleet.filter((m) => {
        const meters = (m as { meters?: { total?: number } }).meters;
        return typeof meters?.total === "number";
      }).length,
      inventoryRecordsAnalyzed,
      excludedSources: [
        ...(lastRun ? [] : ["No completed analysis run yet"]),
        "Full PM schedule engine not scored in this analysis version",
      ],
    },
    moduleCounts: {
      SERVICE: active.filter((i) => i.sourceModule === "SERVICE").length,
      PM: active.filter((i) => i.sourceModule === "PM").length,
      FLEET: active.filter((i) => i.sourceModule === "FLEET").length,
      INVENTORY: active.filter((i) => i.sourceModule === "INVENTORY").length,
      DATA_QUALITY: active.filter((i) => i.sourceModule === "DATA_QUALITY").length,
      GENERAL: active.filter((i) => i.sourceModule === "GENERAL").length,
    },
    briefing: buildBriefing(active, lastRun?.completedAt?.toISOString() ?? null),
    quickLinks: [
      { label: "Service Calls", href: "/service-calls" },
      { label: "Fleet / Digital Twin", href: "/digital-twin" },
      { label: "Maintenance / PM", href: "/maintenance" },
      { label: "Inventory", href: "/inventory" },
      { label: "Data Quality Center", href: "/admin/data-quality" },
      { label: "Approval Center", href: "/admin/approvals" },
      { label: "Organization Health", href: "/admin/organization-health" },
    ],
    advisoryNotice: ADVISORY,
  };
}

export async function getAiOperationsHealth(organizationId = DEFAULT_ORG_ID) {
  const active = await getActiveAnalysisRun(organizationId);
  const lastOk = await prisma.aiOpsAnalysisRun.findFirst({
    where: { organizationId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });
  const lastFail = await prisma.aiOpsAnalysisRun.findFirst({
    where: { organizationId, status: "FAILED" },
    orderBy: { completedAt: "desc" },
  });
  const lastScheduled = await prisma.aiOpsAnalysisRun.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });

  let state: AiHealthState = "HEALTHY";
  if (!aiConfig.enabled) state = "UNAVAILABLE";
  else if (!lastOk) state = "NOT_CONFIGURED";
  else if (
    lastOk.completedAt &&
    Date.now() - lastOk.completedAt.getTime() > 72 * 36e5
  ) {
    state = "STALE";
  } else if (lastFail && lastOk.completedAt && lastFail.completedAt && lastFail.completedAt > lastOk.completedAt) {
    state = "DEGRADED";
  }

  return {
    state,
    available: aiConfig.enabled,
    lastSuccessfulAnalysisAt: lastOk?.completedAt?.toISOString() ?? null,
    lastFailedAnalysisAt: lastFail?.completedAt?.toISOString() ?? null,
    lastScheduledAnalysisAt: lastScheduled?.createdAt.toISOString() ?? null,
    lastDurationMs: lastOk?.durationMs ?? null,
    recordsAnalyzed: lastOk?.recordsAnalyzed ?? 0,
    recordsSkipped: lastOk?.recordsSkipped ?? 0,
    configurationVersion: aiConfig.version,
    rulesVersion: aiConfig.rulesVersion,
    analysisVersion: aiConfig.analysisVersion,
    latestErrorSummary: lastFail?.errorSummary ?? null,
    activeRun: active,
    retryStatus: active ? active.status : "IDLE",
    moduleFreshness: {
      service: lastOk ? "Analyzed" : "Not analyzed",
      fleet: lastOk ? "Analyzed" : "Not analyzed",
      inventory: lastOk ? "Partial" : "Not analyzed",
      pm: "Limited",
      dataQuality: "Limited",
    },
  };
}

export async function getAiOperationsTrends(
  organizationId = DEFAULT_ORG_ID,
  days = 30,
) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const insights = await prisma.aiOpsInsight.findMany({
    where: { organizationId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });
  if (insights.length === 0) {
    return {
      ok: true,
      empty: true,
      message: "No trend data is available for the selected range.",
      series: [],
      averages: {
        confidence: null,
        acknowledgeHours: null,
        resolveHours: null,
      },
    };
  }

  const byDay = new Map<
    string,
    { created: number; critical: number; resolved: number }
  >();
  for (const i of insights) {
    const day = i.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { created: 0, critical: 0, resolved: 0 };
    bucket.created += 1;
    if (i.severity === "CRITICAL" || i.severity === "HIGH") bucket.critical += 1;
    if (i.status === "RESOLVED" || i.status === "ARCHIVED") bucket.resolved += 1;
    byDay.set(day, bucket);
  }

  const series = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));
  const avgConfidence =
    insights.reduce((n, i) => n + i.confidence, 0) / insights.length;

  return {
    ok: true,
    empty: false,
    message: null,
    series,
    averages: {
      confidence: Math.round(avgConfidence),
      acknowledgeHours: null,
      resolveHours: null,
    },
  };
}
