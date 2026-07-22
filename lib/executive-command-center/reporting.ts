/**
 * Patch 51A.5 Part 3 — Period windows, scorecards, comparisons, widgets, AI summary.
 */

import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { listTechnicians } from "@/lib/service-dispatch";
import { listCustomers } from "@/lib/crm/repository";
import { listAdminMachines } from "@/lib/admin/data/machines";
import {
  getDashboardMetrics,
  listBalances,
  listTransactions,
} from "@/lib/inventory";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { computeExecutiveFleetHealth } from "./fleet-health";
import { getCachedReport, setCachedReport } from "./report-cache";
import type {
  AiExecutiveReportSummary,
  ComparisonMode,
  DashboardWidget,
  ExecutiveReportPeriod,
  KpiScorecardItem,
  PeriodReportBundle,
  TrendComparisonRow,
} from "./reporting-types";

export type { PeriodReportBundle, ExecutiveReportPeriod } from "./reporting-types";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function periodWindows(period: ExecutiveReportPeriod, now = new Date()): {
  current: { start: Date; end: Date };
  previous: { start: Date; end: Date };
  label: string;
} {
  const end = startOfDay(now);
  const tomorrow = addDays(end, 1);

  if (period === "DAILY") {
    const start = end;
    const prevStart = addDays(start, -1);
    return {
      current: { start, end: tomorrow },
      previous: { start: prevStart, end: start },
      label: "Daily report",
    };
  }
  if (period === "WEEKLY") {
    const start = addDays(end, -6);
    const prevEnd = start;
    const prevStart = addDays(prevEnd, -7);
    return {
      current: { start, end: tomorrow },
      previous: { start: prevStart, end: prevEnd },
      label: "Weekly report",
    };
  }
  if (period === "MONTHLY") {
    const start = addDays(end, -29);
    const prevEnd = start;
    const prevStart = addDays(prevEnd, -30);
    return {
      current: { start, end: tomorrow },
      previous: { start: prevStart, end: prevEnd },
      label: "Monthly report",
    };
  }
  if (period === "QUARTERLY") {
    const start = addDays(end, -89);
    const prevEnd = start;
    const prevStart = addDays(prevEnd, -90);
    return {
      current: { start, end: tomorrow },
      previous: { start: prevStart, end: prevEnd },
      label: "Quarterly report",
    };
  }
  const start = new Date(end.getFullYear(), 0, 1);
  const prevStart = new Date(end.getFullYear() - 1, 0, 1);
  const prevEnd = new Date(end.getFullYear(), 0, 1);
  return {
    current: { start, end: tomorrow },
    previous: { start: prevStart, end: prevEnd },
    label: "Annual report",
  };
}

export function parseReportPeriod(raw: string | null | undefined): ExecutiveReportPeriod {
  const v = (raw ?? "WEEKLY").toUpperCase();
  if (
    v === "DAILY" ||
    v === "WEEKLY" ||
    v === "MONTHLY" ||
    v === "QUARTERLY" ||
    v === "ANNUAL"
  ) {
    return v;
  }
  return "WEEKLY";
}

export function comparisonModeWindows(mode: ComparisonMode, now = new Date()) {
  if (mode === "WEEK_VS_PREV") return periodWindows("WEEKLY", now);
  if (mode === "MONTH_VS_PREV") return periodWindows("MONTHLY", now);
  if (mode === "QUARTER_VS_PREV") return periodWindows("QUARTERLY", now);
  return periodWindows("ANNUAL", now);
}

function inWindow(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function scoreStatus(
  value: number | null,
  excellent: number,
  good: number,
  watch: number,
  higherIsBetter = true,
): KpiScorecardItem["status"] {
  if (value == null) return "unavailable";
  if (higherIsBetter) {
    if (value >= excellent) return "excellent";
    if (value >= good) return "good";
    if (value >= watch) return "watch";
    return "critical";
  }
  if (value <= excellent) return "excellent";
  if (value <= good) return "good";
  if (value <= watch) return "watch";
  return "critical";
}

function deltaRow(
  metric: string,
  current: number,
  previous: number,
): TrendComparisonRow {
  const delta = current - previous;
  const deltaPercent =
    previous === 0 ? (current === 0 ? 0 : null) : Math.round((delta / previous) * 1000) / 10;
  return {
    metric,
    current,
    previous,
    delta,
    deltaPercent,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
}

function enrichKpi(
  item: KpiScorecardItem,
  previousValue: number | null | undefined,
  higherIsBetter = true,
): KpiScorecardItem {
  if (item.value == null || previousValue == null) {
    return {
      ...item,
      previousValue: previousValue ?? null,
      absoluteChange: null,
      percentChange: null,
      trend: "unavailable",
      updatedAt: new Date().toISOString(),
    };
  }
  const absoluteChange = Math.round((item.value - previousValue) * 10) / 10;
  const percentChange =
    previousValue === 0
      ? item.value === 0
        ? 0
        : null
      : Math.round((absoluteChange / previousValue) * 1000) / 10;
  const rawTrend: "up" | "down" | "flat" =
    absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "flat";
  return {
    ...item,
    previousValue,
    absoluteChange,
    percentChange,
    trend: rawTrend,
    // For display: rising response time is worse — still report raw direction
    detail:
      item.detail +
      (higherIsBetter
        ? ""
        : rawTrend === "up"
          ? " (higher is worse for this metric)"
          : ""),
    updatedAt: new Date().toISOString(),
  };
}

function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number } {
  const p = Math.max(1, page);
  const size = Math.min(50, Math.max(1, pageSize));
  const start = (p - 1) * size;
  return {
    items: rows.slice(start, start + size),
    total: rows.length,
    page: p,
    pageSize: size,
  };
}

function buildAiSummary(input: {
  scorecards: KpiScorecardItem[];
  comparisons: TrendComparisonRow[];
  openRisks: number;
  recommendations: number;
}): AiExecutiveReportSummary {
  const byKey = Object.fromEntries(input.scorecards.map((s) => [s.key, s]));
  const sections: AiExecutiveReportSummary["sections"] = [
    {
      title: "Fleet Health",
      body:
        byKey.fleetHealth?.available
          ? `Fleet health score is ${byKey.fleetHealth.value} (${byKey.fleetHealth.status}). ${byKey.fleetHealth.detail}`
          : "Fleet health score unavailable — insufficient machine data.",
      kind: "fact",
    },
    {
      title: "PM Compliance",
      body:
        byKey.pmCompliance?.available
          ? `PM compliance is ${byKey.pmCompliance.value}%. ${byKey.pmCompliance.detail}`
          : "PM compliance unavailable — no active PM states.",
      kind: "fact",
    },
    {
      title: "Customer Health",
      body:
        byKey.customerSat?.available
          ? `Customer satisfaction proxy is ${byKey.customerSat.value}. ${byKey.customerSat.detail}`
          : "Customer satisfaction ratings are sparse; watch open critical calls by customer instead.",
      kind: "fact",
    },
    {
      title: "Technician Performance",
      body:
        byKey.techProductivity?.available
          ? `Technician productivity index is ${byKey.techProductivity.value}. ${byKey.techProductivity.detail}`
          : "Technician productivity unavailable — roster empty.",
      kind: "fact",
    },
    {
      title: "Inventory Status",
      body:
        byKey.inventoryAccuracy?.available
          ? `Inventory health proxy is ${byKey.inventoryAccuracy.value}. ${byKey.inventoryAccuracy.detail}`
          : "Inventory metrics unavailable.",
      kind: "fact",
    },
    {
      title: "Open Risks",
      body: `${input.openRisks} open high-priority operational risks (critical calls + predictive alerts/decisions).`,
      kind: "fact",
    },
    {
      title: "AI Recommendations",
      body: `${input.recommendations} open Decision Engine / AI items need executive attention. Review the Decision Center before approving high-impact actions.`,
      kind: "recommendation",
    },
  ];

  const worst = input.comparisons
    .filter((c) => c.direction === "up" && /critical|open|risk/i.test(c.metric))
    .slice(0, 2)
    .map((c) => `${c.metric} ${c.previous} → ${c.current}`)
    .join("; ");

  return {
    summary: [
      `Executive period summary generated in sample/local mode.`,
      sections[0]?.body,
      worst ? `Watch trends: ${worst}.` : "No adverse critical-volume trend spikes detected in comparison window.",
    ].join(" "),
    sections,
    generatedAt: new Date().toISOString(),
    isSample: true,
    provider: "matrix-local",
    model: "executive-report-summary-v1",
    confidence: Math.min(
      85,
      Math.round(
        (input.scorecards.filter((s) => s.available).length /
          Math.max(1, input.scorecards.length)) *
          100,
      ),
    ),
  };
}

export async function getExecutivePeriodReport(input?: {
  organizationId?: string;
  period?: string | null;
  page?: number;
  pageSize?: number;
  bypassCache?: boolean;
}): Promise<PeriodReportBundle> {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const period = parseReportPeriod(input?.period);
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 5;
  const cacheKey = `period:${period}:p${page}:s${pageSize}`;

  if (!input?.bypassCache) {
    const cached = await getCachedReport<PeriodReportBundle>(organizationId, cacheKey);
    if (cached) return { ...cached, cacheHit: true };
  }

  const windows = periodWindows(period);
  const calls = listServiceCalls({ includeDeleted: false });
  const currentCalls = calls.filter((c) =>
    inWindow(c.createdAt, windows.current.start, windows.current.end),
  );
  const previousCalls = calls.filter((c) =>
    inWindow(c.createdAt, windows.previous.start, windows.previous.end),
  );
  const openCalls = calls.filter((c) => isOpenServiceCallStatus(c.status));
  const criticalOpen = openCalls.filter(
    (c) =>
      c.priority === "CRITICAL" ||
      c.priority === "EMERGENCY" ||
      c.problem.machineCurrentlyDown,
  );

  const closedCurrent = currentCalls.filter(
    (c) => c.status === "CLOSED" || c.status === "RESOLVED" || Boolean(c.closedAt),
  );
  const closedPrevious = previousCalls.filter(
    (c) => c.status === "CLOSED" || c.status === "RESOLVED" || Boolean(c.closedAt),
  );

  // First-time fix proxy: closed without WAITING_FOR_PARTS history and no second open within 14d
  let ftfNumer = 0;
  let ftfDenom = 0;
  for (const c of closedCurrent) {
    ftfDenom += 1;
    const closedAtMs = new Date(c.closedAt || c.updatedAt).getTime();
    const revisited = calls.some((other) => {
      if (other.id === c.id) return false;
      if (other.machine.machineId !== c.machine.machineId) return false;
      const otherMs = new Date(other.createdAt).getTime();
      return otherMs > closedAtMs && otherMs - closedAtMs < 14 * 86_400_000;
    });
    const waitedParts = c.parts.some((p) => p.ordered) || c.status === "WAITING_FOR_PARTS";
    if (!revisited && !waitedParts) ftfNumer += 1;
  }
  const firstTimeFix =
    ftfDenom === 0 ? null : Math.round((ftfNumer / ftfDenom) * 100);

  // Response time proxy (hours from create to arrival/scheduled start)
  const responseHours: number[] = [];
  for (const c of currentCalls) {
    const arrival = c.schedule?.arrivalDateTime || c.schedule?.scheduledStart;
    if (!arrival) continue;
    const hours =
      (new Date(arrival).getTime() - new Date(c.createdAt).getTime()) / 3_600_000;
    if (hours >= 0 && hours < 720) responseHours.push(hours);
  }
  const avgResponse =
    responseHours.length === 0
      ? null
      : Math.round(
          (responseHours.reduce((a, b) => a + b, 0) / responseHours.length) * 10,
        ) / 10;

  const machines = listAdminMachines({ recordState: "ACTIVE", pageSize: 5000 });
  const up =
    machines.items.length === 0
      ? null
      : Math.round(
          (machines.items.filter(
            (m) => m.status !== "DOWN" && m.status !== "OFFLINE" && m.status !== "RETIRED",
          ).length /
            machines.items.length) *
            100,
        );

  const pmStates = await prisma.machinePmState.findMany({
    where: { active: true },
    take: 500,
    select: {
      machineId: true,
      customerName: true,
      currentMeterCount: true,
      nextPmDueCount: true,
    },
  });
  const pmOverdue = pmStates.filter(
    (s) =>
      s.nextPmDueCount != null &&
      s.currentMeterCount != null &&
      s.currentMeterCount >= s.nextPmDueCount,
  );
  const pmCompliance =
    pmStates.length === 0
      ? null
      : Math.round(((pmStates.length - pmOverdue.length) / pmStates.length) * 100);

  const snapshots = await prisma.machineHealthSnapshot.findMany({
    where: { organizationId },
    orderBy: { generatedAt: "desc" },
    take: 300,
    select: { machineId: true, riskLevel: true, healthScore: true },
  });
  const latest = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!latest.has(s.machineId)) latest.set(s.machineId, s);
  }
  const atRisk = [...latest.values()].filter(
    (s) => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL",
  );

  const fleet = computeExecutiveFleetHealth({
    activeMachines: Math.max(pmStates.length, machines.items.length),
    criticalServiceCalls: criticalOpen.length,
    openServiceCalls: openCalls.length,
    pmOverdue: pmOverdue.length,
    machinesAtRisk: atRisk.length,
    criticalAlerts: atRisk.filter((s) => s.riskLevel === "CRITICAL").length,
    dataFreshnessScore: 70,
  });

  const techs = listTechnicians();
  const techProductivity =
    techs.length === 0
      ? null
      : Math.round(
          (techs.filter((t) =>
            ["AVAILABLE", "ON_SITE", "TRAVELING", "ASSIGNED"].includes(t.status),
          ).length /
            techs.length) *
            100,
        );

  const ratings = calls
    .map((c) => c.customerConfirmation?.satisfactionRating)
    .filter((r): r is number => typeof r === "number" && r > 0);
  const customerSat =
    ratings.length === 0
      ? null
      : Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20);

  let invMetrics: ReturnType<typeof getDashboardMetrics> | null = null;
  try {
    invMetrics = getDashboardMetrics();
  } catch {
    invMetrics = null;
  }
  const inventoryAccuracy =
    invMetrics == null
      ? null
      : Math.max(
          0,
          100 -
            Math.min(
              60,
              (invMetrics.lowStock ?? 0) * 3 + (invMetrics.outOfStock ?? 0) * 5,
            ),
        );

  // Previous-period FTF proxy for scorecard deltas
  let prevFtfNumer = 0;
  let prevFtfDenom = 0;
  for (const c of closedPrevious) {
    prevFtfDenom += 1;
    const closedAtMs = new Date(c.closedAt || c.updatedAt).getTime();
    const revisited = calls.some((other) => {
      if (other.id === c.id) return false;
      if (other.machine.machineId !== c.machine.machineId) return false;
      const otherMs = new Date(other.createdAt).getTime();
      return otherMs > closedAtMs && otherMs - closedAtMs < 14 * 86_400_000;
    });
    const waitedParts = c.parts.some((p) => p.ordered) || c.status === "WAITING_FOR_PARTS";
    if (!revisited && !waitedParts) prevFtfNumer += 1;
  }
  const prevFirstTimeFix =
    prevFtfDenom === 0 ? null : Math.round((prevFtfNumer / prevFtfDenom) * 100);

  const scorecards: KpiScorecardItem[] = [
    enrichKpi(
      {
        key: "fleetHealth",
        label: "Fleet Health",
        value: fleet.score,
        unit: "score",
        status: scoreStatus(fleet.score, 90, 75, 55),
        detail: fleet.score == null ? "No active machines" : `Status ${fleet.status}`,
        definition: "Explainable fleet score from critical calls, PM overdue, and predictive risk.",
        href: "/executive-command-center/predictive",
        available: fleet.score != null,
      },
      null,
    ),
    enrichKpi(
      {
        key: "uptime",
        label: "Machine Uptime",
        value: up,
        unit: "percent",
        status: scoreStatus(up, 95, 85, 70),
        detail:
          up == null
            ? "No machine records"
            : `${machines.items.filter((m) => m.status !== "DOWN").length}/${machines.items.length} not down`,
        definition: "Share of active machines not marked DOWN/OFFLINE/RETIRED.",
        href: "/digital-twin",
        available: up != null,
      },
      null,
    ),
    enrichKpi(
      {
        key: "firstTimeFix",
        label: "First Time Fix %",
        value: firstTimeFix,
        unit: "percent",
        status: scoreStatus(firstTimeFix, 85, 70, 55),
        detail:
          firstTimeFix == null
            ? "No closed calls in period"
            : `Proxy from ${ftfDenom} closed calls (no quick revisit)`,
        definition: "Closed calls without parts wait and without revisit within 14 days.",
        href: "/service-calls?status=CLOSED",
        available: firstTimeFix != null,
      },
      prevFirstTimeFix,
    ),
    enrichKpi(
      {
        key: "responseTime",
        label: "Response Time",
        value: avgResponse,
        unit: "hours",
        status: scoreStatus(avgResponse, 4, 8, 24, false),
        detail:
          avgResponse == null
            ? "No arrival/schedule timestamps in period"
            : `Avg hours to arrival/schedule (${responseHours.length} samples)`,
        definition: "Average hours from call create to arrival/scheduled start.",
        href: "/service-calls?status=OPEN",
        available: avgResponse != null,
      },
      null,
      false,
    ),
    enrichKpi(
      {
        key: "openCalls",
        label: "Open Service Calls",
        value: openCalls.length,
        unit: "count",
        status: scoreStatus(openCalls.length, 5, 15, 30, false),
        detail: `${criticalOpen.length} critical/emergency among open`,
        definition: "Currently open service calls (workflow open statuses).",
        href: "/service-calls?status=OPEN",
        available: true,
      },
      Math.max(0, previousCalls.length - closedPrevious.length),
      false,
    ),
    enrichKpi(
      {
        key: "inventoryAccuracy",
        label: "Inventory Accuracy",
        value: inventoryAccuracy,
        unit: "score",
        status: scoreStatus(inventoryAccuracy, 90, 75, 60),
        detail:
          inventoryAccuracy == null
            ? "Inventory metrics unavailable"
            : `Proxy from low/out-of-stock pressure (low=${invMetrics?.lowStock ?? 0})`,
        definition: "Proxy score from low-stock and stockout pressure (not cycle-count variance).",
        href: "/inventory?filter=lowStock",
        available: inventoryAccuracy != null,
      },
      null,
    ),
    enrichKpi(
      {
        key: "customerSat",
        label: "Customer Satisfaction",
        value: customerSat,
        unit: "score",
        status: scoreStatus(customerSat, 90, 75, 60),
        detail:
          customerSat == null
            ? "No satisfaction ratings recorded"
            : `Scaled from ${ratings.length} ratings`,
        definition: "Requires recorded satisfaction ratings — withheld when absent.",
        href: "/executive-command-center/customers",
        available: customerSat != null,
      },
      null,
    ),
    enrichKpi(
      {
        key: "techProductivity",
        label: "Technician Productivity",
        value: techProductivity,
        unit: "percent",
        status: scoreStatus(techProductivity, 85, 65, 40),
        detail:
          techProductivity == null
            ? "No technician roster"
            : `% of technicians actively covering`,
        definition: "Share of technicians in available/on-call coverage states.",
        href: "/executive-command-center/technicians",
        available: techProductivity != null,
      },
      null,
    ),
    enrichKpi(
      {
        key: "pmCompliance",
        label: "PM Compliance",
        value: pmCompliance,
        unit: "percent",
        status: scoreStatus(pmCompliance, 95, 85, 70),
        detail:
          pmCompliance == null
            ? "No PM states"
            : `${pmStates.length - pmOverdue.length}/${pmStates.length} not overdue`,
        definition: "Share of active PM states not overdue by meter.",
        href: "/maintenance?filter=overdue",
        available: pmCompliance != null,
      },
      null,
    ),
    enrichKpi(
      {
        key: "lowStock",
        label: "Low-stock Count",
        value: invMetrics?.lowStock ?? null,
        unit: "count",
        status: scoreStatus(invMetrics?.lowStock ?? null, 2, 8, 20, false),
        detail:
          invMetrics == null ? "Inventory metrics unavailable" : "Parts at/below reorder point",
        definition: "Count of parts at or below reorder point.",
        href: "/inventory?filter=lowStock",
        available: invMetrics != null,
      },
      null,
      false,
    ),
    enrichKpi(
      {
        key: "stockouts",
        label: "Stockout Count",
        value: invMetrics?.outOfStock ?? null,
        unit: "count",
        status: scoreStatus(invMetrics?.outOfStock ?? null, 0, 3, 8, false),
        detail: invMetrics == null ? "Inventory metrics unavailable" : "Zero on-hand parts",
        definition: "Count of parts with zero quantity on hand.",
        href: "/inventory?filter=outOfStock",
        available: invMetrics != null,
      },
      null,
      false,
    ),
  ];

  const comparisons: TrendComparisonRow[] = [
    deltaRow("Calls created", currentCalls.length, previousCalls.length),
    deltaRow("Calls closed", closedCurrent.length, closedPrevious.length),
    deltaRow(
      "Critical calls created",
      currentCalls.filter(
        (c) =>
          c.priority === "CRITICAL" ||
          c.priority === "EMERGENCY" ||
          c.problem.machineCurrentlyDown,
      ).length,
      previousCalls.filter(
        (c) =>
          c.priority === "CRITICAL" ||
          c.priority === "EMERGENCY" ||
          c.problem.machineCurrentlyDown,
      ).length,
    ),
    deltaRow(
      "Open-at-end proxy",
      openCalls.length,
      Math.max(0, previousCalls.length - closedPrevious.length),
    ),
  ];

  // Widgets
  const customers = listCustomers(1, 200).items;
  const customerScores = customers
    .map((c) => {
      const related = openCalls.filter(
        (call) =>
          call.machine.customerName?.toLowerCase() === c.name.toLowerCase(),
      );
      const crit = related.filter(
        (call) =>
          call.priority === "CRITICAL" || call.problem.machineCurrentlyDown,
      );
      return {
        id: c.id,
        label: c.name,
        value: `${related.length} open`,
        secondary: crit.length ? `${crit.length} critical` : "stable",
        href: `/customers/${encodeURIComponent(c.id)}`,
        sort: crit.length * 10 + related.length,
      };
    })
    .sort((a, b) => b.sort - a.sort);

  const machineCostProxy = new Map<string, number>();
  for (const c of calls) {
    const id = c.machine.machineId;
    machineCostProxy.set(id, (machineCostProxy.get(id) ?? 0) + 1 + c.parts.length * 2);
  }
  const highestCost = [...machineCostProxy.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([id, score]) => ({
      id,
      label: id,
      value: `Cost proxy ${score}`,
      secondary: "Service visits + parts lines",
      href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(id)}`,
    }));

  const byMachineRecent = new Map<string, number>();
  for (const c of calls.filter(
    (x) => Date.now() - new Date(x.createdAt).getTime() < 90 * 86_400_000,
  )) {
    byMachineRecent.set(
      c.machine.machineId,
      (byMachineRecent.get(c.machine.machineId) ?? 0) + 1,
    );
  }
  const repeats = [...byMachineRecent.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({
      id,
      label: id,
      value: `${n} calls / 90d`,
      href: `/service-calls`,
    }));

  const aging = openCalls
    .map((c) => ({
      call: c,
      ageHours: (Date.now() - new Date(c.createdAt).getTime()) / 3_600_000,
    }))
    .filter((x) => x.ageHours >= 24)
    .sort((a, b) => b.ageHours - a.ageHours)
    .map((x) => ({
      id: x.call.id,
      label: x.call.ticketNumber || x.call.id,
      value: `${Math.round(x.ageHours)}h open`,
      secondary: x.call.machine.machineId,
      href: "/service-calls",
    }));

  let partsConsumption: DashboardWidget["rows"] = [];
  try {
    const tx = listTransactions(500).filter(
      (t) =>
        t.type === "CONSUME" &&
        inWindow(t.occurredAt, windows.current.start, windows.current.end),
    );
    const usage = new Map<string, number>();
    for (const t of tx) {
      usage.set(t.partId, (usage.get(t.partId) ?? 0) + t.quantity);
    }
    partsConsumption = [...usage.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([partId, qty]) => ({
        id: partId,
        label: partId,
        value: `${qty} consumed`,
        href: "/inventory",
      }));
  } catch {
    partsConsumption = [];
  }

  let invForecast: DashboardWidget["rows"] = [];
  try {
    invForecast = listBalances()
      .filter((b) => b.quantityOnHand <= b.reorderPoint)
      .slice(0, 50)
      .map((b) => ({
        id: `${b.partId}:${b.locationId}`,
        label: b.partId,
        value: `On hand ${b.quantityOnHand} / reorder ${b.reorderPoint}`,
        secondary: b.locationId,
        href: "/inventory",
      }));
  } catch {
    invForecast = [];
  }

  const mkWidget = (
    key: string,
    title: string,
    rows: DashboardWidget["rows"],
    emptyMessage: string,
  ): DashboardWidget => {
    const paged = paginateRows(rows, page, pageSize);
    return {
      key,
      title,
      empty: rows.length === 0,
      emptyMessage,
      rows: paged.items,
      page: paged.page,
      pageSize: paged.pageSize,
      total: paged.total,
    };
  };

  const widgets: DashboardWidget[] = [
    mkWidget(
      "topCustomers",
      "Top Customers (attention)",
      customerScores.map((r) => ({
        id: r.id,
        label: r.label,
        value: r.value,
        secondary: r.secondary,
        href: r.href,
      })),
      "No customer open-call pressure.",
    ),
    mkWidget(
      "highestCostMachines",
      "Highest Cost Machines",
      highestCost,
      "No service/parts activity to rank machines.",
    ),
    mkWidget("repeatCalls", "Repeat Service Calls", repeats, "No repeat patterns (≥3/90d)."),
    mkWidget("agingCalls", "Aging Open Calls", aging, "No open calls older than 24h."),
    mkWidget(
      "pmCompletion",
      "PM Completion",
      pmStates.slice(0, 50).map((s) => ({
        id: s.machineId,
        label: s.machineId,
        value:
          s.nextPmDueCount != null &&
          s.currentMeterCount != null &&
          s.currentMeterCount >= s.nextPmDueCount
            ? "Overdue"
            : "On track",
        secondary: s.customerName ?? undefined,
        href: "/maintenance",
      })),
      "No PM states loaded.",
    ),
    mkWidget(
      "partsConsumption",
      "Parts Consumption",
      partsConsumption,
      "No consume transactions in period.",
    ),
    mkWidget(
      "inventoryForecast",
      "Inventory Forecast (reorder)",
      invForecast,
      "No balances at/below reorder point.",
    ),
  ];

  const openDecisions = await prisma.decisionRecommendation.count({
    where: {
      organizationId,
      status: { in: ["NEW", "REVIEW_REQUIRED", "APPROVED", "ASSIGNED", "IN_PROGRESS"] },
      priority: { in: ["CRITICAL", "HIGH"] },
    },
  });
  const openAlerts = await prisma.predictiveRiskAlert.count({
    where: { organizationId, status: "OPEN" },
  });

  const aiSummary = buildAiSummary({
    scorecards,
    comparisons,
    openRisks: criticalOpen.length + openAlerts + atRisk.length,
    recommendations: openDecisions,
  });

  const bundle: PeriodReportBundle = {
    period,
    periodLabel: windows.label,
    generatedAt: new Date().toISOString(),
    window: {
      start: windows.current.start.toISOString(),
      end: windows.current.end.toISOString(),
    },
    previousWindow: {
      start: windows.previous.start.toISOString(),
      end: windows.previous.end.toISOString(),
    },
    scorecards,
    comparisons,
    widgets,
    aiSummary,
    highlights: [
      `${currentCalls.length} calls created in period`,
      `${closedCurrent.length} closed/resolved in period`,
      `${criticalOpen.length} critical open now`,
      pmCompliance == null ? "PM compliance n/a" : `PM compliance ${pmCompliance}%`,
    ],
    cacheHit: false,
  };

  await setCachedReport(organizationId, cacheKey, bundle, 60);
  return bundle;
}

export async function getTrendComparisons(mode: ComparisonMode) {
  const period =
    mode === "WEEK_VS_PREV"
      ? "WEEKLY"
      : mode === "MONTH_VS_PREV"
        ? "MONTHLY"
        : mode === "QUARTER_VS_PREV"
          ? "QUARTERLY"
          : "ANNUAL";
  const report = await getExecutivePeriodReport({ period, page: 1, pageSize: 5 });
  return {
    mode,
    period,
    comparisons: report.comparisons,
    window: report.window,
    previousWindow: report.previousWindow,
    generatedAt: report.generatedAt,
  };
}
