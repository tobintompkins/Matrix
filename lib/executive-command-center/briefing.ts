/**
 * Patch 51A.5 Part 1 — AI Executive Briefing (sample / fail-open).
 * Reuses Matrix Assist sample-mode approach — never invents missing facts.
 */

import type {
  ExecutiveBriefing,
  ExecutiveCommandCenterSummary,
  ExecutivePriorityItem,
} from "./types";

const BRIEFING_VERSION = "executive-briefing-v1";

export function buildExecutiveBriefing(input: {
  kpis: ExecutiveCommandCenterSummary["kpis"];
  fleetHealth: ExecutiveCommandCenterSummary["fleetHealth"];
  priorities: ExecutivePriorityItem[];
}): ExecutiveBriefing {
  try {
    const { kpis, fleetHealth, priorities } = input;
    const top = priorities.slice(0, 5);
    const insufficientData =
      kpis.activeMachines === 0 &&
      kpis.openServiceCalls === 0 &&
      priorities.length === 0;

    if (insufficientData) {
      return {
        summary:
          "Not enough operational activity is loaded to produce a confident executive briefing. Add fleet, service, or PM records, then refresh.",
        priorities: [],
        generatedAt: new Date().toISOString(),
        provider: "matrix-local",
        model: "deterministic-template",
        isSample: true,
        insufficientData: true,
        confidence: 0,
      };
    }

    const scoreLabel =
      fleetHealth.score == null
        ? "unknown (insufficient machine data)"
        : `${fleetHealth.score} (${fleetHealth.status})`;

    const summary = [
      `Fleet health is currently ${scoreLabel} with about ${fleetHealth.confidence}% scoring confidence.`,
      `${kpis.openServiceCalls} open service call(s) including ${kpis.criticalServiceCalls} critical/emergency.`,
      `${kpis.machinesAtRisk} machine(s) at high predictive risk; ${kpis.pmOverdue} PM overdue by meter.`,
      `${kpis.activeTechnicians} technician(s) available or on coverage (${kpis.technicianCoverageLabel}).`,
    ].join(" ");

    const briefingPriorities: ExecutiveBriefing["priorities"] = top.map(
      (p) => ({
        title: p.title,
        reason: p.reason,
        href: p.href,
        kind: "fact" as const,
      }),
    );

    if (top[0]) {
      briefingPriorities.push({
        title: `Recommended focus: ${top[0].recommendedNextStep}`,
        reason:
          "Derived from the highest-ranked operational priority — review the linked record before acting.",
        href: top[0].href,
        kind: "recommendation",
      });
    }

    return {
      summary,
      priorities: briefingPriorities.slice(0, 5),
      generatedAt: new Date().toISOString(),
      provider: "matrix-local",
      model: BRIEFING_VERSION,
      isSample: true,
      insufficientData: false,
      confidence: Math.min(85, Math.max(25, fleetHealth.confidence)),
    };
  } catch {
    return {
      summary:
        "Executive briefing is temporarily unavailable. KPI and priority panels below still reflect live Matrix data when present.",
      priorities: [],
      generatedAt: new Date().toISOString(),
      provider: "matrix-local",
      model: BRIEFING_VERSION,
      isSample: true,
      insufficientData: true,
      confidence: 0,
    };
  }
}
