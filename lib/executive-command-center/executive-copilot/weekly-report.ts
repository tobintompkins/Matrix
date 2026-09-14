/**
 * Patch 51C.3 — Weekly executive report narrative from existing WEEKLY period report.
 */

import { getExecutivePeriodReport } from "../reporting";
import { getExecutiveDecisionSupport } from "./decision-support";
import type { WeeklyExecutiveReportSummary } from "./types";

export async function buildWeeklyExecutiveReport(input?: {
  organizationId?: string;
}): Promise<WeeklyExecutiveReportSummary> {
  const [report, decisions] = await Promise.all([
    getExecutivePeriodReport({
      organizationId: input?.organizationId,
      period: "WEEKLY",
      bypassCache: true,
    }),
    getExecutiveDecisionSupport({ organizationId: input?.organizationId }),
  ]);

  const byPrefix = (prefix: RegExp) =>
    report.scorecards
      .filter((s) => s.available && prefix.test(s.key + s.label))
      .map((s) => `${s.label}: ${s.value}${s.unit === "percent" ? "%" : ""} (${s.status})`);

  const serviceMetrics = [
    ...report.highlights.filter((h) => /call|critical|closed/i.test(h)),
    ...byPrefix(/service|call|fleet/i),
  ].slice(0, 6);

  const pmMetrics = [
    ...report.highlights.filter((h) => /\bpm\b/i.test(h)),
    ...byPrefix(/^pm|preventive/i),
  ].slice(0, 6);

  const inventoryMetrics = byPrefix(/inventory|parts|stock/i).slice(0, 6);
  const customerTrends = report.comparisons
    .filter((c) => /customer|call|open/i.test(c.metric))
    .slice(0, 5)
    .map(
      (c) =>
        `${c.metric}: ${c.previous} → ${c.current} (${c.direction}, Δ ${c.delta})`,
    );

  const customerWidget = report.widgets.find((w) => w.key === "topCustomers");
  if (customerWidget && !customerWidget.empty) {
    customerTrends.push(
      ...customerWidget.rows
        .slice(0, 3)
        .map((r) => `Attention customer: ${r.label} (${r.value})`),
    );
  }

  const aiRecommendations = [
    ...report.aiSummary.sections
      .filter((s) => s.kind === "recommendation")
      .map((s) => s.body),
    ...decisions.recommendations.map((r) => r.title),
  ].slice(0, 8);

  const operationalRisks = [
    ...report.highlights.filter((h) => /critical|risk|overdue|stock/i.test(h)),
    ...report.aiSummary.sections
      .filter((s) => s.kind === "fact" && /risk|critical|watch/i.test(s.body))
      .map((s) => s.body),
  ].slice(0, 8);

  const available = report.scorecards.filter((s) => s.available).length;
  const confidence = Math.round(
    Math.min(95, 35 + available * 8 + (report.cacheHit ? 0 : 5)),
  );

  return {
    generatedAt: report.generatedAt,
    periodLabel: report.periodLabel,
    serviceMetrics:
      serviceMetrics.length > 0 ? serviceMetrics : ["Service metrics unavailable."],
    pmMetrics: pmMetrics.length > 0 ? pmMetrics : ["PM metrics unavailable."],
    inventoryMetrics:
      inventoryMetrics.length > 0
        ? inventoryMetrics
        : ["Inventory metrics unavailable."],
    customerTrends:
      customerTrends.length > 0 ? customerTrends : ["No customer trend deltas."],
    aiRecommendations:
      aiRecommendations.length > 0
        ? aiRecommendations
        : ["No AI recommendations this week."],
    operationalRisks:
      operationalRisks.length > 0
        ? operationalRisks
        : ["No elevated operational risks listed."],
    confidence,
    assumptions: [
      "Weekly report reuses the existing WEEKLY period report bundle — not a separate reporting system.",
      "AI recommendations are advisory; Matrix Assist packaging may restate facts but must not invent metrics.",
      ...decisions.assumptions.slice(0, 1),
    ],
    href: "/executive-command-center/report-center?period=WEEKLY",
  };
}
