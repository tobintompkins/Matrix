/**
 * Patch 51A.2 — Approval / risk policy.
 */

import { getAction } from "../registry/actions";
import type {
  AutomationActionDef,
  AutomationApprovalMode,
  AutomationRiskLevel,
} from "../types";

export const HIGH_IMPACT_ACTION_KEYS = new Set([
  "ai.draft_customer_communication",
  "service_call.update_priority",
  "service_call.close",
  "inventory.deduct_stock",
]);

export function classifyActionRisk(actionKey: string): AutomationRiskLevel {
  const def = getAction(actionKey);
  if (!def) return "MEDIUM";
  if (!def.available && def.highImpact) return "CRITICAL";
  if (def.highImpact) return "HIGH";
  return "LOW";
}

export function requiresApproval(input: {
  approvalMode: AutomationApprovalMode | string;
  riskLevel: AutomationRiskLevel | string;
  actions: AutomationActionDef[];
  settingsHighImpactRequireApproval: boolean;
}): { required: boolean; reason: string; highImpactActions: string[] } {
  const highImpactActions = input.actions
    .filter((a) => {
      const def = getAction(a.actionKey);
      return a.highImpact || def?.highImpact || HIGH_IMPACT_ACTION_KEYS.has(a.actionKey);
    })
    .map((a) => a.actionKey);

  if (input.approvalMode === "ALWAYS" || input.approvalMode === "BEFORE_RUN") {
    return {
      required: true,
      reason: `Approval mode is ${input.approvalMode}.`,
      highImpactActions,
    };
  }

  if (
    (input.approvalMode === "BEFORE_HIGH_IMPACT_ACTION" ||
      input.settingsHighImpactRequireApproval) &&
    highImpactActions.length > 0
  ) {
    return {
      required: true,
      reason: `High-impact actions require approval: ${highImpactActions.join(", ")}.`,
      highImpactActions,
    };
  }

  if (input.riskLevel === "CRITICAL") {
    return {
      required: true,
      reason: "Automation risk level is CRITICAL.",
      highImpactActions,
    };
  }

  return { required: false, reason: "No approval required.", highImpactActions };
}
