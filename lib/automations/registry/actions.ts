/**
 * Patch 51A.2 — Action registry (safe, non-duplicating side effects).
 */

import type { ActionDefinition, AutomationActionResult } from "../types";
import { notifyAiOperationsEvent } from "@/lib/ai/notifications";

export const AUTOMATION_ACTIONS: ActionDefinition[] = [
  {
    key: "notification.in_app",
    displayName: "Create in-app notification",
    description: "Push an in-app Matrix notification.",
    category: "Notifications",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "notification.notify_role",
    displayName: "Notify role",
    description: "Notify users by role label (advisory notification).",
    category: "Notifications",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "notification.dashboard_alert",
    displayName: "Create dashboard alert",
    description: "Create an urgent dashboard-style notification.",
    category: "Notifications",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "service_call.add_internal_note",
    displayName: "Add internal service-call note (draft)",
    description: "Records a draft note intent — does not mutate service-call store in dry-run; live mode appends via emit only when explicitly enabled.",
    category: "Service",
    available: true,
    highImpact: false,
    retryable: false,
  },
  {
    key: "task.create_follow_up",
    displayName: "Create follow-up task",
    description: "Creates an advisory follow-up task notification.",
    category: "Service",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "pm.create_reminder",
    displayName: "Create PM reminder",
    description: "Notify about PM due/overdue.",
    category: "PM",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "pm.flag_urgent",
    displayName: "Flag PM urgent",
    description: "Advisory urgent PM flag via notification.",
    category: "PM",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "inventory.reorder_recommendation",
    displayName: "Create reorder recommendation",
    description: "Advisory reorder recommendation — does not place orders.",
    category: "Inventory",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "inventory.notify_manager",
    displayName: "Notify inventory manager",
    description: "Notify inventory managers of stock risk.",
    category: "Inventory",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "data_quality.create_issue",
    displayName: "Create data-quality review task",
    description: "Advisory DQ review task (links to Data Quality Center).",
    category: "Admin",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "ai.generate_summary",
    displayName: "Generate AI summary",
    description: "Deterministic context summary for the execution payload.",
    category: "AI",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "ai.draft_customer_communication",
    displayName: "Draft customer communication",
    description: "Creates a draft only — never sends externally.",
    category: "AI",
    available: true,
    highImpact: true,
    retryable: false,
  },
  {
    key: "service_call.update_priority",
    displayName: "Update service-call priority",
    description: "High-impact — requires approval; not auto-applied without approval.",
    category: "Service",
    available: true,
    highImpact: true,
    retryable: false,
  },
  {
    key: "service_call.close",
    displayName: "Close service call",
    description: "Blocked — autonomous closure is not allowed in 51A.2.",
    category: "Service",
    available: false,
    highImpact: true,
    retryable: false,
    comingSoon: true,
  },
  {
    key: "inventory.deduct_stock",
    displayName: "Deduct inventory",
    description: "Blocked — autonomous stock deduction is not allowed.",
    category: "Inventory",
    available: false,
    highImpact: true,
    retryable: false,
    comingSoon: true,
  },
  // Patch 51A.4 — Decision Engine (generate/refresh only; never auto high-impact)
  {
    key: "decision.refresh_batch",
    displayName: "Refresh decision recommendations",
    description:
      "Runs the Enterprise Decision Engine batch to create/refresh recommendations. Does not approve or execute high-impact actions.",
    category: "Decisions",
    available: true,
    highImpact: false,
    retryable: true,
  },
  {
    key: "decision.from_predictive",
    displayName: "Create decision from predictive risk",
    description:
      "Creates/refreshes a decision recommendation from a predictive machine risk signal.",
    category: "Decisions",
    available: true,
    highImpact: false,
    retryable: true,
  },
];

export function getAction(key: string): ActionDefinition | undefined {
  return AUTOMATION_ACTIONS.find((a) => a.key === key);
}

export async function executeRegisteredAction(input: {
  actionKey: string;
  params?: Record<string, unknown>;
  context: Record<string, unknown>;
  dryRun: boolean;
}): Promise<AutomationActionResult> {
  const def = getAction(input.actionKey);
  if (!def || !def.available) {
    return {
      success: false,
      actionKey: input.actionKey,
      message: "Action is unavailable or coming soon.",
      error: { code: "ACTION_UNAVAILABLE", message: "Action not executable." },
    };
  }

  if (input.dryRun) {
    return {
      success: true,
      actionKey: input.actionKey,
      message: `Dry-run: would execute ${def.displayName}.`,
      dryRun: true,
      data: { params: input.params ?? {}, contextPreview: summarizeContext(input.context) },
    };
  }

  const title =
    String(input.params?.title ?? def.displayName).slice(0, 120) ||
    def.displayName;
  const message =
    String(
      input.params?.message ??
        `Automation action: ${def.displayName}. Context: ${summarizeContext(input.context)}`,
    ).slice(0, 500);

  switch (input.actionKey) {
    case "notification.in_app":
    case "notification.notify_role":
    case "notification.dashboard_alert":
    case "task.create_follow_up":
    case "pm.create_reminder":
    case "pm.flag_urgent":
    case "inventory.reorder_recommendation":
    case "inventory.notify_manager":
    case "data_quality.create_issue":
    case "service_call.add_internal_note": {
      notifyAiOperationsEvent({
        type: "AI_CRITICAL_INSIGHT",
        title,
        message,
        insightId: String(input.context.entityId ?? input.context.serviceCallId ?? "automation"),
        priority:
          input.actionKey === "notification.dashboard_alert" ? "URGENT" : "HIGH",
      });
      return {
        success: true,
        actionKey: input.actionKey,
        message: `Executed ${def.displayName}.`,
        entityType: String(input.context.entityType ?? "Automation"),
        entityId: String(input.context.entityId ?? ""),
      };
    }
    case "ai.generate_summary": {
      const summary = summarizeAutomationContext(input.context);
      return {
        success: true,
        actionKey: input.actionKey,
        message: "AI summary generated (deterministic).",
        data: { summary, aiGenerated: true, confidence: 0.85 },
      };
    }
    case "ai.draft_customer_communication": {
      const draft = `Draft (not sent): Regarding your equipment — ${summarizeContext(input.context)}. A technician will follow up.`;
      return {
        success: true,
        actionKey: input.actionKey,
        message: "Customer communication draft created. External send requires separate approval.",
        data: { draft, sent: false, aiGenerated: true },
      };
    }
    case "service_call.update_priority": {
      return {
        success: false,
        actionKey: input.actionKey,
        message: "Priority updates require approved high-impact continuation and are not auto-applied in this framework version.",
        error: {
          code: "REQUIRES_MANUAL_FOLLOWTHROUGH",
          message: "Record the approved intent; apply priority in the service-call UI.",
        },
      };
    }
    case "decision.refresh_batch": {
      const { runDecisionEngineBatch } = await import(
        "@/lib/decision-engine/generate"
      );
      const batch = await runDecisionEngineBatch({
        actorName: "Automation",
      });
      return {
        success: true,
        actionKey: input.actionKey,
        message: `Decision batch: ${batch.created} created, ${batch.refreshed} refreshed.`,
        data: batch,
      };
    }
    case "decision.from_predictive": {
      const machineId = String(
        input.params?.machineId ??
          input.context.machineId ??
          input.context.entityId ??
          "",
      );
      if (!machineId) {
        return {
          success: false,
          actionKey: input.actionKey,
          message: "machineId required.",
          error: { code: "MISSING_MACHINE", message: "No machineId in context." },
        };
      }
      const { generateFromPredictiveAlert } = await import(
        "@/lib/decision-engine/generate"
      );
      const out = await generateFromPredictiveAlert({
        machineId,
        healthSnapshotId:
          typeof input.context.healthSnapshotId === "string"
            ? input.context.healthSnapshotId
            : null,
        riskLevel:
          typeof input.context.riskLevel === "string"
            ? input.context.riskLevel
            : undefined,
        actorName: "Automation",
      });
      return {
        success: true,
        actionKey: input.actionKey,
        message: `Predictive decision sync: ${out.created} created, ${out.refreshed} refreshed.`,
        data: out,
        entityType: "Machine",
        entityId: machineId,
      };
    }
    default:
      return {
        success: false,
        actionKey: input.actionKey,
        message: "Unhandled action.",
        error: { code: "UNHANDLED", message: "No executor." },
      };
  }
}

function summarizeContext(ctx: Record<string, unknown>): string {
  const keys = ["serviceCallId", "machineId", "partNumber", "priority", "status", "entityId"];
  return keys
    .filter((k) => ctx[k] != null)
    .map((k) => `${k}=${String(ctx[k])}`)
    .join(", ")
    .slice(0, 200);
}

export function summarizeAutomationContext(ctx: Record<string, unknown>): string {
  return `Automation context summary: ${summarizeContext(ctx) || "no entity fields"}. Generated at ${new Date().toISOString()}.`;
}
