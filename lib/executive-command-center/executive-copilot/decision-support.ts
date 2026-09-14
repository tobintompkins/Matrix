/**
 * Patch 51C.3 — Decision support recommendations.
 * Advisory only — never executes PM, inventory, assignment, or CRM mutations.
 */

import { getExecutiveCommandCenterSummary } from "../summary";
import { getDashboardMetrics } from "@/lib/inventory";
import type { CopilotDecisionRecommendation } from "./types";

let seq = 0;
function rec(
  partial: Omit<
    CopilotDecisionRecommendation,
    "executable" | "requiresUserConfirmation" | "id"
  >,
): CopilotDecisionRecommendation {
  seq += 1;
  return {
    ...partial,
    id: `exec-rec-${seq}`,
    executable: false,
    requiresUserConfirmation: true,
  };
}

export async function getExecutiveDecisionSupport(input?: {
  organizationId?: string;
}): Promise<{
  recommendations: CopilotDecisionRecommendation[];
  executable: false;
  assumptions: string[];
}> {
  seq = 0;
  const summary = await getExecutiveCommandCenterSummary(input?.organizationId);
  const out: CopilotDecisionRecommendation[] = [];

  if (summary.kpis.pmOverdue > 0) {
    out.push(
      rec({
        action: "increase_pm",
        title: "Increase PM focus on overdue meters",
        rationale: `${summary.kpis.pmOverdue} machine(s) are PM overdue by meter.`,
        priority: summary.kpis.pmOverdue >= 5 ? "HIGH" : "MEDIUM",
        href: "/maintenance?filter=overdue",
      }),
    );
  }

  let invOut = 0;
  let invLow = 0;
  try {
    const m = getDashboardMetrics();
    invOut = m.outOfStock ?? 0;
    invLow = m.lowStock ?? 0;
  } catch {
    /* optional */
  }
  if (invOut > 0 || invLow > 0) {
    out.push(
      rec({
        action: "order_inventory",
        title: "Review reorder for stock pressure",
        rationale: `Stockouts ${invOut} · low stock ${invLow}. Confirm demand before purchasing.`,
        priority: invOut > 0 ? "HIGH" : "MEDIUM",
        href: "/inventory",
      }),
    );
    out.push(
      rec({
        action: "inventory_optimization",
        title: "Inventory optimization review",
        rationale: "Balance truck stock vs warehouse for parts with reorder pressure.",
        priority: "LOW",
        href: "/executive-command-center/predictive-analytics",
      }),
    );
  }

  if (summary.kpis.criticalServiceCalls > 0) {
    out.push(
      rec({
        action: "schedule_technician",
        title: "Schedule coverage for critical open calls",
        rationale: `${summary.kpis.criticalServiceCalls} critical/down call(s) open — assign manually in dispatch.`,
        priority: "CRITICAL",
        href: "/dispatch",
      }),
    );
  }

  if (summary.kpis.machinesAtRisk > 0) {
    out.push(
      rec({
        action: "watch_failing_machines",
        title: "Watch elevated predictive-risk machines",
        rationale: `${summary.kpis.machinesAtRisk} machine(s) at elevated predictive risk.`,
        priority: "HIGH",
        href: "/executive-command-center/predictive",
      }),
    );
  }

  if (summary.kpis.criticalServiceCalls > 0 || summary.kpis.openServiceCalls >= 5) {
    out.push(
      rec({
        action: "escalate_customer",
        title: "Escalate customers with operational pressure",
        rationale: `${summary.kpis.openServiceCalls} open calls (${summary.kpis.criticalServiceCalls} critical) — review Customer Reliability.`,
        priority: summary.kpis.criticalServiceCalls > 0 ? "HIGH" : "MEDIUM",
        href: "/executive-command-center/customers",
      }),
    );
  }

  if (
    summary.kpis.technicianCoverageLabel &&
    /low|gap|overload/i.test(summary.kpis.technicianCoverageLabel)
  ) {
    out.push(
      rec({
        action: "training_opportunity",
        title: "Review technician skill / coverage gaps",
        rationale: `Coverage: ${summary.kpis.technicianCoverageLabel}. Consider training or rebalancing.`,
        priority: "MEDIUM",
        href: "/executive-command-center/technicians",
      }),
    );
  }

  if (out.length === 0) {
    out.push(
      rec({
        action: "watch_failing_machines",
        title: "No urgent executive actions detected",
        rationale:
          "Continue monitoring fleet health, PM, and inventory on the Command Center overview.",
        priority: "LOW",
        href: "/executive-command-center",
      }),
    );
  }

  return {
    recommendations: out.slice(0, 8),
    executable: false,
    assumptions: [
      "Recommendations are decision support only — never auto-executed.",
      "Based on live Matrix ECC summary, inventory metrics, and predictive risk counts.",
      "User confirmation required before any operational change.",
    ],
  };
}
