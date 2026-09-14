/**
 * Patch 51A.5 Part 2 — Executive intelligence & analytics aggregation.
 * Reuses service calls, PM, predictive, AI insights, CRM, technicians, decisions.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { listTechnicians } from "@/lib/service-dispatch";
import { listCustomers } from "@/lib/crm/repository";
import { getAiOperationsTrends } from "@/lib/ai/dashboard";
import { getDecisionSummary } from "@/lib/decision-engine/analytics";
import { OPEN_DECISION_STATUSES } from "@/lib/decision-engine/types";
import {
  isIsoInRange,
  parseExecutiveRange,
  rangeStartDate,
  rangeToDays,
} from "./date-range";
import { computeExecutiveFleetHealth } from "./fleet-health";
import { getTechnicianProductivityAnalytics } from "./technician-productivity";
import { computeCustomerReliabilityScore } from "./customer-reliability";
import { getPartsConsumptionAnalytics } from "./parts-consumption";
import { getOrgHealthBridge } from "./org-health-bridge";
import { isEnterpriseIntelligence51c1Enabled } from "./feature-flag";
import type {
  AiInsightSummary,
  CustomerHealthRow,
  ExecutiveAnalyticsPayload,
  ExecutiveReportSection,
  PredictiveAnalytics,
  TechnicianMetricRow,
  TrendPoint,
} from "./analytics-types";

export type {
  AiInsightSummary,
  CustomerHealthRow,
  ExecutiveAnalyticsPayload,
  ExecutiveReportSection,
  PredictiveAnalytics,
  TechnicianMetricRow,
  TrendPoint,
} from "./analytics-types";

function dayKey(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function emptyDayMap(start: Date, days: number): Map<string, TrendPoint> {
  const map = new Map<string, TrendPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKey(d);
    map.set(key, {
      date: key,
      openCalls: 0,
      criticalCalls: 0,
      closedCalls: 0,
      insightsCreated: 0,
      insightsCritical: 0,
    });
  }
  return map;
}

export async function getExecutiveAnalytics(input?: {
  organizationId?: string;
  range?: string | null;
}): Promise<ExecutiveAnalyticsPayload> {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const range = parseExecutiveRange(input?.range);
  const days = Math.min(rangeToDays(range), 120);
  const start = rangeStartDate(range);
  const generatedAt = new Date().toISOString();

  const calls = listServiceCalls({ includeDeleted: false });
  const callsInRange = calls.filter((c) => isIsoInRange(c.createdAt, range));
  const openCalls = calls.filter((c) => isOpenServiceCallStatus(c.status));
  const criticalOpen = openCalls.filter(
    (c) =>
      c.priority === "CRITICAL" ||
      c.priority === "EMERGENCY" ||
      c.priority === "URGENT" ||
      c.problem.machineCurrentlyDown,
  );

  const [
    pmStates,
    healthSnapshots,
    predictiveAlerts,
    insights,
    openDecisionsCount,
    decisionSummary,
    aiTrends,
  ] = await Promise.all([
    prisma.machinePmState.findMany({
      where: { active: true },
      take: 500,
      select: {
        machineId: true,
        customerName: true,
        currentMeterCount: true,
        nextPmDueCount: true,
      },
    }),
    prisma.machineHealthSnapshot.findMany({
      where: { organizationId },
      orderBy: { generatedAt: "desc" },
      take: 400,
      select: {
        machineId: true,
        riskLevel: true,
        healthScore: true,
        primaryRiskReason: true,
        predictedMaintenanceDate: true,
        generatedAt: true,
      },
    }),
    prisma.predictiveRiskAlert.findMany({
      where: { organizationId, status: "OPEN" },
      take: 100,
      select: { id: true, severity: true, machineId: true },
    }),
    prisma.aiOpsInsight.findMany({
      where: { organizationId, createdAt: { gte: start } },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        confidence: true,
        createdAt: true,
      },
    }),
    prisma.decisionRecommendation.count({
      where: {
        organizationId,
        status: { in: OPEN_DECISION_STATUSES },
      },
    }),
    getDecisionSummary(organizationId).catch(() => null),
    getAiOperationsTrends(organizationId, days).catch(() => ({
      empty: true,
      series: [] as Array<{
        date: string;
        created: number;
        critical: number;
        resolved: number;
      }>,
    })),
  ]);

  const latestHealth = new Map<string, (typeof healthSnapshots)[0]>();
  for (const s of healthSnapshots) {
    if (!latestHealth.has(s.machineId)) latestHealth.set(s.machineId, s);
  }
  const atRisk = [...latestHealth.values()].filter(
    (s) => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL",
  );
  const pmOverdue = pmStates.filter(
    (s) =>
      s.nextPmDueCount != null &&
      s.currentMeterCount != null &&
      s.currentMeterCount >= s.nextPmDueCount,
  );

  const technicians = listTechnicians();
  const techProductivity = getTechnicianProductivityAnalytics({ days });
  const techRows: TechnicianMetricRow[] = techProductivity.rows.map((r) => ({
    name: r.name,
    status: r.status,
    openCalls: r.openCalls,
    criticalCalls: r.criticalCalls,
    closedInRange: r.closedInRange,
    completionRate: r.completionRate,
    workloadHours: r.workloadHours,
    capacityHours: r.capacityHours,
    workloadVsCapacityPct: r.workloadVsCapacityPct,
    territory: r.territory,
    href: r.href,
  }));

  const customers = listCustomers(1, 200).items;
  const riskByMachineCustomer = new Map<string, number>();
  for (const s of atRisk) {
    const pm = pmStates.find(
      (p) => p.machineId.toLowerCase() === s.machineId.toLowerCase(),
    );
    const key = (pm?.customerName || "Unknown").toLowerCase();
    riskByMachineCustomer.set(key, (riskByMachineCustomer.get(key) ?? 0) + 1);
  }

  const repeatByCustomer = new Map<string, number>();
  const ninetyMs = Date.now() - 90 * 86_400_000;
  const recentByCustomerMachine = new Map<string, Set<string>>();
  for (const c of calls) {
    if (new Date(c.createdAt).getTime() < ninetyMs) continue;
    const cust = (c.machine.customerName || "Unknown").toLowerCase();
    const mid = (c.machine.machineId || c.id).toLowerCase();
    const set = recentByCustomerMachine.get(cust) ?? new Set();
    set.add(mid);
    recentByCustomerMachine.set(cust, set);
  }
  for (const [cust, machines] of recentByCustomerMachine) {
    let repeats = 0;
    for (const mid of machines) {
      const count = calls.filter(
        (c) =>
          (c.machine.customerName || "").toLowerCase() === cust &&
          (c.machine.machineId || "").toLowerCase() === mid &&
          new Date(c.createdAt).getTime() >= ninetyMs,
      ).length;
      if (count >= 3) repeats += 1;
    }
    repeatByCustomer.set(cust, repeats);
  }

  const customerRows: CustomerHealthRow[] = customers.map((c) => {
    const name = c.name;
    const related = openCalls.filter(
      (call) =>
        call.machine.customerName?.toLowerCase() === name.toLowerCase() ||
        call.machine.customerName?.toLowerCase().includes(name.toLowerCase()),
    );
    const crit = related.filter(
      (call) =>
        call.priority === "CRITICAL" ||
        call.priority === "EMERGENCY" ||
        call.problem.machineCurrentlyDown,
    );
    const machinesAtRisk = riskByMachineCustomer.get(name.toLowerCase()) ?? 0;
    const scored = computeCustomerReliabilityScore({
      openCalls: related.length,
      criticalCalls: crit.length,
      machinesAtRisk,
      repeatCallSites: repeatByCustomer.get(name.toLowerCase()) ?? 0,
    });
    return {
      customerId: c.id,
      name,
      openCalls: related.length,
      criticalCalls: crit.length,
      machinesAtRisk,
      reliabilityScore: scored.reliabilityScore,
      riskLabel: scored.riskLabel,
      href: `/customers/${encodeURIComponent(c.id)}`,
    };
  });
  customerRows.sort(
    (a, b) =>
      a.reliabilityScore - b.reliabilityScore ||
      b.criticalCalls - a.criticalCalls ||
      b.machinesAtRisk - a.machinesAtRisk,
  );

  const dueSoon14d = [...latestHealth.values()].filter((s) => {
    if (!s.predictedMaintenanceDate) return false;
    const daysLeft =
      (s.predictedMaintenanceDate.getTime() - Date.now()) / 86_400_000;
    return daysLeft >= 0 && daysLeft <= 14;
  }).length;

  const trendBucket = emptyDayMap(start, days);
  const predictiveTrend = new Map<
    string,
    { highRisk: number; criticalRisk: number; evaluated: number }
  >();
  for (const key of trendBucket.keys()) {
    predictiveTrend.set(key, { highRisk: 0, criticalRisk: 0, evaluated: 0 });
  }
  for (const s of healthSnapshots) {
    const key = dayKey(s.generatedAt);
    const bucket = predictiveTrend.get(key);
    if (!bucket) continue;
    bucket.evaluated += 1;
    if (s.riskLevel === "HIGH") bucket.highRisk += 1;
    if (s.riskLevel === "CRITICAL") bucket.criticalRisk += 1;
  }

  const predictive: PredictiveAnalytics = {
    machinesEvaluated: latestHealth.size,
    highRisk: atRisk.filter((s) => s.riskLevel === "HIGH").length,
    criticalRisk: atRisk.filter((s) => s.riskLevel === "CRITICAL").length,
    openAlerts: predictiveAlerts.length,
    dueSoon14d,
    trendSeries: [...predictiveTrend.entries()].map(([date, v]) => ({
      date,
      highRisk: v.highRisk,
      criticalRisk: v.criticalRisk,
      evaluated: v.evaluated,
    })),
    topRiskMachines: atRisk
      .slice()
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 10)
      .map((s) => ({
        machineId: s.machineId,
        riskLevel: s.riskLevel,
        healthScore: s.healthScore,
        reason: s.primaryRiskReason,
        href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(s.machineId)}`,
      })),
  };

  const partsRaw = getPartsConsumptionAnalytics({ days });
  const partsConsumption = {
    totalConsumed: partsRaw.totalConsumed,
    distinctParts: partsRaw.distinctParts,
    issueEvents: partsRaw.issueEvents,
    empty: partsRaw.empty,
    emptyMessage: partsRaw.emptyMessage,
    topParts: partsRaw.topParts.slice(0, 10),
    href: partsRaw.href,
  };

  const activeInsights = insights.filter(
    (i) => !["RESOLVED", "DISMISSED", "ARCHIVED"].includes(i.status),
  );
  const aiInsights: AiInsightSummary = {
    active: activeInsights.length,
    critical: activeInsights.filter(
      (i) => i.severity === "CRITICAL" || i.severity === "HIGH",
    ).length,
    pendingReview: activeInsights.filter((i) =>
      ["NEW", "REVIEWING", "ACTION_REQUIRED"].includes(i.status),
    ).length,
    trendEmpty: Boolean(aiTrends.empty),
    series: aiTrends.series ?? [],
    topInsights: activeInsights.slice(0, 8).map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      status: i.status,
      href: `/ai-operations?insight=${encodeURIComponent(i.id)}`,
    })),
  };

  const seriesMap = emptyDayMap(start, days);
  for (const c of callsInRange) {
    const key = dayKey(c.createdAt);
    const bucket = seriesMap.get(key);
    if (!bucket) continue;
    if (isOpenServiceCallStatus(c.status)) bucket.openCalls += 1;
    if (
      c.priority === "CRITICAL" ||
      c.priority === "EMERGENCY" ||
      c.problem.machineCurrentlyDown
    ) {
      bucket.criticalCalls += 1;
    }
    if (c.status === "CLOSED" || c.status === "RESOLVED") bucket.closedCalls += 1;
  }
  for (const i of insights) {
    const key = dayKey(i.createdAt);
    const bucket = seriesMap.get(key);
    if (!bucket) continue;
    bucket.insightsCreated += 1;
    if (i.severity === "CRITICAL" || i.severity === "HIGH") {
      bucket.insightsCritical += 1;
    }
  }
  const series = [...seriesMap.values()];
  const seriesEmpty = series.every(
    (p) =>
      p.openCalls === 0 &&
      p.criticalCalls === 0 &&
      p.closedCalls === 0 &&
      p.insightsCreated === 0,
  );

  const fleetHealth = computeExecutiveFleetHealth({
    activeMachines: Math.max(pmStates.length, latestHealth.size),
    criticalServiceCalls: criticalOpen.length,
    openServiceCalls: openCalls.length,
    pmOverdue: pmOverdue.length,
    machinesAtRisk: atRisk.length,
    criticalAlerts: predictiveAlerts.filter((a) => a.severity === "CRITICAL")
      .length,
    dataFreshnessScore: 70,
  });

  const reports: ExecutiveReportSection[] = [
    {
      key: "service",
      title: "Service operations",
      summary: `${openCalls.length} open calls (${criticalOpen.length} critical) in current operations; ${callsInRange.length} created in selected range.`,
      metrics: [
        { label: "Open", value: String(openCalls.length) },
        { label: "Critical", value: String(criticalOpen.length) },
        { label: "Created in range", value: String(callsInRange.length) },
      ],
      href: "/service-calls",
    },
    {
      key: "pm",
      title: "Preventive maintenance",
      summary: `${pmOverdue.length} machines overdue by meter across ${pmStates.length} active PM states.`,
      metrics: [
        { label: "Active PM machines", value: String(pmStates.length) },
        { label: "Overdue", value: String(pmOverdue.length) },
      ],
      href: "/maintenance/executive",
    },
    {
      key: "predictive",
      title: "Predictive risk",
      summary: `${predictive.criticalRisk} critical and ${predictive.highRisk} high-risk machines; ${predictive.dueSoon14d} due within 14 days.`,
      metrics: [
        { label: "Evaluated", value: String(predictive.machinesEvaluated) },
        { label: "Open alerts", value: String(predictive.openAlerts) },
      ],
      href: "/ai-operations/predictive-maintenance",
    },
    {
      key: "decisions",
      title: "Decision engine",
      summary: `${openDecisionsCount} open recommendations${
        decisionSummary
          ? `; acceptance rate ${decisionSummary.acceptanceRate ?? "n/a"}%`
          : ""
      }.`,
      metrics: [
        { label: "Open decisions", value: String(openDecisionsCount) },
        {
          label: "Critical open",
          value: String(decisionSummary?.critical ?? 0),
        },
      ],
      href: "/ai-operations/decisions",
    },
    {
      key: "ai",
      title: "AI insights",
      summary: `${aiInsights.active} active insights (${aiInsights.critical} high/critical) in range.`,
      metrics: [
        { label: "Active", value: String(aiInsights.active) },
        { label: "Pending review", value: String(aiInsights.pendingReview) },
      ],
      href: "/ai-operations",
    },
    {
      key: "customers",
      title: "Customer reliability",
      summary: `${customerRows.filter((c) => c.riskLabel === "Critical" || c.riskLabel === "At Risk").length} customers need attention (reliability scored from open/critical/predictive pressure).`,
      metrics: [
        { label: "Customers scored", value: String(customerRows.length) },
        {
          label: "At risk / critical",
          value: String(
            customerRows.filter(
              (c) => c.riskLabel === "Critical" || c.riskLabel === "At Risk",
            ).length,
          ),
        },
      ],
      href: "/executive-command-center/customers",
    },
    {
      key: "partsConsumption",
      title: "Parts consumption",
      summary: partsConsumption.empty
        ? partsConsumption.emptyMessage ?? "No consumption in range."
        : `${partsConsumption.totalConsumed} units consumed across ${partsConsumption.distinctParts} parts (${partsConsumption.issueEvents} CONSUME events).`,
      metrics: [
        { label: "Units consumed", value: String(partsConsumption.totalConsumed) },
        { label: "Distinct parts", value: String(partsConsumption.distinctParts) },
      ],
      href: "/inventory",
    },
    {
      key: "technicianProductivity",
      title: "Technician productivity",
      summary: `${techRows.length} technicians; closed-in-range completions derived from service-call history.`,
      metrics: [
        {
          label: "Closed in range",
          value: String(techRows.reduce((s, t) => s + t.closedInRange, 0)),
        },
        {
          label: "Open assigned",
          value: String(techRows.reduce((s, t) => s + t.openCalls, 0)),
        },
      ],
      href: "/executive-command-center/technicians",
    },
  ];

  if (isEnterpriseIntelligence51c1Enabled()) {
    const orgBridge = await getOrgHealthBridge(organizationId);
    reports.push({
      key: "organizationHealth",
      title: "Organization health",
      summary: orgBridge.enabled
        ? `Overall ${orgBridge.overallScore ?? "n/a"} (${orgBridge.classification}); ${orgBridge.availableCategories} categories available.`
        : orgBridge.message ?? "Organization Health unavailable.",
      metrics: orgBridge.kpis.map((k) => ({
        label: k.label,
        value: k.value,
      })),
      href: orgBridge.href,
    });
  }

  try {
    const { buildPredictiveBusinessReportSections } = await import(
      "./predictive-business/predictive-reports"
    );
    const pbaSections = await buildPredictiveBusinessReportSections();
    reports.push(...pbaSections);
  } catch {
    /* optional */
  }

  const signals = [
    openCalls.length > 0 || callsInRange.length > 0,
    pmStates.length > 0,
    latestHealth.size > 0,
    technicians.length > 0,
    customers.length > 0,
    insights.length > 0 || openDecisionsCount > 0,
  ];
  const dataCompleteness = Math.round(
    (signals.filter(Boolean).length / signals.length) * 100,
  );
  const empty = signals.every((s) => !s);

  const orgHealthScore = isEnterpriseIntelligence51c1Enabled()
    ? (await getOrgHealthBridge(organizationId)).overallScore
    : null;

  return {
    generatedAt,
    range,
    rangeLabel:
      range === "TODAY"
        ? "Today"
        : range === "LAST_7"
          ? "Last 7 days"
          : range === "LAST_30"
            ? "Last 30 days"
            : range === "LAST_90"
              ? "Last 90 days"
              : range === "QTD"
                ? "Quarter to date"
                : "Year to date",
    days,
    dataCompleteness,
    empty,
    emptyMessage: empty
      ? "No analytics signals in this range yet. As service, PM, predictive, and AI data accumulate, trends and reports will appear here."
      : null,
    kpiTrends: {
      current: {
        openServiceCalls: openCalls.length,
        criticalServiceCalls: criticalOpen.length,
        pmOverdue: pmOverdue.length,
        machinesAtRisk: atRisk.length,
        activeTechnicians: technicians.filter((t) =>
          ["AVAILABLE", "ON_SITE", "TRAVELING", "ASSIGNED"].includes(t.status),
        ).length,
        fleetHealthScore: fleetHealth.score,
        openDecisions: openDecisionsCount,
        organizationHealthScore: orgHealthScore,
      },
      series,
      seriesEmpty,
    },
    technicians: techRows,
    customers: customerRows.slice(0, 40),
    predictive,
    partsConsumption,
    aiInsights,
    reports,
    drilldowns: [
      {
        key: "trends",
        label: "KPI trends",
        href: "/executive-command-center/trends",
        count: series.length,
      },
      {
        key: "technicians",
        label: "Technician productivity",
        href: "/executive-command-center/technicians",
        count: techRows.length,
      },
      {
        key: "customers",
        label: "Customer reliability",
        href: "/executive-command-center/customers",
        count: customerRows.length,
      },
      {
        key: "parts",
        label: "Parts consumption",
        href: "/inventory",
        count: partsConsumption.distinctParts,
      },
      {
        key: "predictive",
        label: "Predictive",
        href: "/executive-command-center/predictive",
        count: predictive.machinesEvaluated,
      },
      {
        key: "insights",
        label: "AI insights",
        href: "/executive-command-center/insights",
        count: aiInsights.active,
      },
      {
        key: "reports",
        label: "Executive reports",
        href: "/executive-command-center/report-center",
        count: reports.length,
      },
    ],
  };
}

export function analyticsToCsv(payload: ExecutiveAnalyticsPayload): string {
  const lines = [
    "section,label,value",
    `meta,range,${payload.range}`,
    `meta,generatedAt,${payload.generatedAt}`,
    ...payload.reports.flatMap((r) =>
      r.metrics.map(
        (m) =>
          `${JSON.stringify(r.key)},${JSON.stringify(m.label)},${JSON.stringify(m.value)}`,
      ),
    ),
    ...payload.technicians.map(
      (t) =>
        `technician,${JSON.stringify(t.name)},${t.openCalls} open / ${t.closedInRange} closed / ${t.criticalCalls} critical`,
    ),
    ...payload.customers.map(
      (c) =>
        `customer,${JSON.stringify(c.name)},score ${c.reliabilityScore} ${c.riskLabel} (${c.openCalls} open)`,
    ),
    ...payload.partsConsumption.topParts.map(
      (p) =>
        `parts,${JSON.stringify(p.partNumber)},${p.quantityConsumed} consumed`,
    ),
  ];
  return lines.join("\n");
}
