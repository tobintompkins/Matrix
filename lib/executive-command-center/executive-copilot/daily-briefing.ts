/**
 * Patch 51C.3 — Daily executive briefing fields.
 * Built from summary + period report + decision support (does not call Briefing Center).
 */

import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { getDashboardMetrics } from "@/lib/inventory";
import { getExecutiveCommandCenterSummary } from "../summary";
import { getExecutivePeriodReport } from "../reporting";
import { getExecutiveDecisionSupport } from "./decision-support";
import type { DailyExecutiveBriefing } from "./types";

export async function buildDailyExecutiveBriefing(input?: {
  organizationId?: string;
}): Promise<DailyExecutiveBriefing> {
  const [summary, report, decisions] = await Promise.all([
    getExecutiveCommandCenterSummary(input?.organizationId),
    getExecutivePeriodReport({
      organizationId: input?.organizationId,
      period: "DAILY",
      bypassCache: true,
    }),
    getExecutiveDecisionSupport({ organizationId: input?.organizationId }),
  ]);

  const calls = listServiceCalls({ includeDeleted: false });
  const open = calls.filter((c) => isOpenServiceCallStatus(c.status));
  const critical = open.filter(
    (c) =>
      c.priority === "CRITICAL" ||
      c.priority === "EMERGENCY" ||
      c.problem.machineCurrentlyDown,
  );
  const down = critical.filter((c) => c.problem.machineCurrentlyDown);

  const openByCustomer = new Map<string, number>();
  for (const c of open) {
    const name = c.machine.customerName || "Unknown";
    openByCustomer.set(name, (openByCustomer.get(name) ?? 0) + 1);
  }
  const criticalCustomers = [...openByCustomer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, n]) => `${name} (${n} open)`);

  let invLow = 0;
  let invOut = 0;
  try {
    const m = getDashboardMetrics();
    invLow = m.lowStock ?? 0;
    invOut = m.outOfStock ?? 0;
  } catch {
    /* optional */
  }

  const pmCard = report.scorecards.find((s) => s.key === "pmCompliance");
  const costWidget = report.widgets.find((w) => w.key === "highestCostMachines");
  const highCost =
    costWidget && !costWidget.empty
      ? costWidget.rows.slice(0, 5).map((r) => `${r.label}: ${r.value}`)
      : ["No high-cost repair activity ranked in the daily window."];

  const confidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (summary.fleetHealth.confidence ?? 40) * 0.5 +
          (report.scorecards.filter((s) => s.available).length / 8) * 50,
      ),
    ),
  );

  return {
    generatedAt: new Date().toISOString(),
    todaysPriorities: summary.priorities.slice(0, 6).map((p) => p.title),
    machineDownSummary: `${down.length} machine-down · ${critical.length} critical/emergency open · ${open.length} open total.`,
    criticalCustomers:
      criticalCustomers.length > 0
        ? criticalCustomers
        : ["No customers with elevated open-call pressure."],
    pmCompliance: pmCard?.available
      ? `${pmCard.value}% — ${pmCard.detail}`
      : `${summary.kpis.pmOverdue} PM overdue by meter · ${summary.kpis.pmDue} due.`,
    inventoryShortages: `Low stock: ${invLow} · Stockouts: ${invOut}.`,
    upcomingPmWorkload: `${summary.kpis.pmDue} due · ${summary.kpis.pmOverdue} overdue (meter state).`,
    openServiceCalls: `${summary.kpis.openServiceCalls} open · ${summary.kpis.criticalServiceCalls} critical.`,
    highCostRepairs: highCost,
    recommendedActions: decisions.recommendations,
    confidence,
    assumptions: [
      "Daily briefing aggregates ECC summary, daily period report, inventory metrics, and open service calls.",
      "Recommended actions are advisory only and never auto-execute.",
      ...decisions.assumptions.slice(0, 2),
    ],
  };
}
