/**
 * Patch 51A.2 — Core automation execution engine (server-only).
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { evaluateConditionGroup } from "./evaluate-conditions";
import { requiresApproval } from "./approval-policy";
import { buildIdempotencyKey, hourBucket } from "./idempotency";
import { executeRegisteredAction } from "../registry/actions";
import { getTrigger } from "../registry/triggers";
import type {
  AutomationActionDef,
  AutomationActionResult,
  AutomationConditionGroup,
} from "../types";
import { explainAutomationDecision } from "../ai/automation-ai";

export type RunAutomationInput = {
  automationId: string;
  organizationId?: string;
  triggerSource: string;
  triggerReferenceId?: string | null;
  payload?: Record<string, unknown>;
  previousPayload?: Record<string, unknown>;
  initiatedById?: string | null;
  dryRun?: boolean;
  force?: boolean;
};

function parseConditions(json: string): AutomationConditionGroup {
  try {
    const parsed = JSON.parse(json) as AutomationConditionGroup;
    if (parsed && parsed.mode && Array.isArray(parsed.conditions)) return parsed;
  } catch {
    /* fall through */
  }
  return { mode: "ALL", conditions: [] };
}

function parseActions(json: string): AutomationActionDef[] {
  try {
    const parsed = JSON.parse(json) as AutomationActionDef[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  return [];
}

export async function getOrCreateSettings(organizationId = DEFAULT_ORG_ID) {
  const existing = await prisma.aiOpsAutomationSetting.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;
  return prisma.aiOpsAutomationSetting.create({
    data: { organizationId },
  });
}

export async function executeAutomation(
  input: RunAutomationInput,
): Promise<{
  ok: boolean;
  executionId?: string;
  status?: string;
  error?: string;
  skipped?: boolean;
}> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const settings = await getOrCreateSettings(organizationId);
  if (!settings.automationEnabled && !input.force) {
    return { ok: false, error: "Automation framework is disabled." };
  }

  const automation = await prisma.aiOpsAutomationDefinition.findFirst({
    where: { id: input.automationId, organizationId },
  });
  if (!automation) return { ok: false, error: "Automation not found." };
  if (
    !input.force &&
    automation.status !== "ACTIVE" &&
    input.triggerSource !== "MANUAL_DRY_RUN" &&
    !input.dryRun
  ) {
    if (automation.status !== "ACTIVE" && !input.dryRun) {
      return { ok: false, error: `Automation status is ${automation.status}.` };
    }
  }

  const dryRun = Boolean(input.dryRun || automation.dryRunEnabled && input.triggerSource === "MANUAL_DRY_RUN");
  const idempotencyKey = buildIdempotencyKey({
    automationId: automation.id,
    triggerSource: input.triggerSource,
    triggerReferenceId: input.triggerReferenceId,
    dryRun,
    windowBucket:
      automation.triggerType === "SCHEDULE" ? hourBucket() : undefined,
  });

  const existing = await prisma.aiOpsAutomationExecution.findUnique({
    where: { idempotencyKey },
  });
  if (
    existing &&
    ["SUCCEEDED", "PARTIALLY_SUCCEEDED", "WAITING_APPROVAL", "RUNNING"].includes(
      existing.status,
    )
  ) {
    return {
      ok: true,
      executionId: existing.id,
      status: existing.status,
      skipped: true,
    };
  }

  const execution = await prisma.aiOpsAutomationExecution.create({
    data: {
      organizationId,
      automationId: automation.id,
      triggerSource: input.triggerSource,
      triggerReferenceId: input.triggerReferenceId ?? null,
      status: "RUNNING",
      startedAt: new Date(),
      inputJson: JSON.stringify(input.payload ?? {}),
      attemptNumber: 1,
      idempotencyKey,
      initiatedById: input.initiatedById ?? null,
      dryRun,
    },
  });

  await writeAdminAudit({
    organizationId,
    actorId: input.initiatedById ?? "system",
    action: "AI_AUTOMATION_RUN_STARTED",
    entityType: "AiOpsAutomationExecution",
    entityId: execution.id,
    payload: { automationId: automation.id, dryRun, trigger: input.triggerSource },
    category: "SYSTEM",
    severity: "INFO",
    outcome: "SUCCESS",
  });

  try {
    const conditions = parseConditions(automation.conditionsJson);
    const condEval = await evaluateConditionGroup(
      conditions,
      input.payload ?? {},
      input.previousPayload,
    );
    const decision = explainAutomationDecision({
      matched: condEval.matched,
      results: condEval.results,
    });

    await prisma.aiOpsAutomationExecution.update({
      where: { id: execution.id },
      data: {
        conditionResultsJson: JSON.stringify({
          matched: condEval.matched,
          results: condEval.results,
          decision,
        }),
      },
    });

    if (!condEval.matched) {
      await finalize(execution.id, automation.id, "SKIPPED", [], null, organizationId);
      return { ok: true, executionId: execution.id, status: "SKIPPED" };
    }

    const actions = parseActions(automation.actionsJson);
    const approval = requiresApproval({
      approvalMode: automation.approvalMode,
      riskLevel: automation.riskLevel,
      actions,
      settingsHighImpactRequireApproval: settings.highImpactActionsRequireApproval,
    });

    if (approval.required && !dryRun) {
      await prisma.aiOpsAutomationExecution.update({
        where: { id: execution.id },
        data: { status: "WAITING_APPROVAL" },
      });
      await prisma.aiOpsAutomationApproval.create({
        data: {
          executionId: execution.id,
          status: "PENDING",
          requestedById: input.initiatedById ?? null,
          reason: approval.reason,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      await writeAdminAudit({
        organizationId,
        actorId: input.initiatedById ?? "system",
        action: "AI_AUTOMATION_APPROVAL_REQUESTED",
        entityType: "AiOpsAutomationExecution",
        entityId: execution.id,
        payload: { reason: approval.reason, highImpactActions: approval.highImpactActions },
        category: "SYSTEM",
        severity: "INFO",
        outcome: "SUCCESS",
      });
      return { ok: true, executionId: execution.id, status: "WAITING_APPROVAL" };
    }

    const actionResults = await runActions({
      actions,
      payload: input.payload ?? {},
      dryRun,
      failurePolicy: automation.failurePolicy,
    });

    const status = deriveStatus(actionResults);
    await finalize(
      execution.id,
      automation.id,
      status,
      actionResults,
      null,
      organizationId,
      status === "FAILED",
      settings.autoPauseFailureThreshold,
    );
    return { ok: true, executionId: execution.id, status };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Execution failed";
    await finalize(
      execution.id,
      automation.id,
      "FAILED",
      [],
      { message },
      organizationId,
      true,
      settings.autoPauseFailureThreshold,
    );
    return { ok: false, executionId: execution.id, status: "FAILED", error: message };
  }
}

async function runActions(input: {
  actions: AutomationActionDef[];
  payload: Record<string, unknown>;
  dryRun: boolean;
  failurePolicy: string;
}): Promise<AutomationActionResult[]> {
  const results: AutomationActionResult[] = [];
  for (const action of input.actions) {
    const result = await executeRegisteredAction({
      actionKey: action.actionKey,
      params: action.params,
      context: input.payload,
      dryRun: input.dryRun,
    });
    results.push(result);
    if (!result.success && !action.optional && input.failurePolicy === "STOP") {
      break;
    }
    if (
      !result.success &&
      input.failurePolicy === "CONTINUE_OPTIONAL" &&
      !action.optional
    ) {
      break;
    }
  }
  return results;
}

function deriveStatus(
  results: AutomationActionResult[],
): "SUCCEEDED" | "PARTIALLY_SUCCEEDED" | "FAILED" | "SKIPPED" {
  if (results.length === 0) return "SUCCEEDED";
  const ok = results.filter((r) => r.success).length;
  if (ok === results.length) return "SUCCEEDED";
  if (ok === 0) return "FAILED";
  return "PARTIALLY_SUCCEEDED";
}

async function finalize(
  executionId: string,
  automationId: string,
  status: string,
  actionResults: AutomationActionResult[],
  error: unknown,
  organizationId: string,
  failed = false,
  autoPauseThreshold = 5,
) {
  await prisma.aiOpsAutomationExecution.update({
    where: { id: executionId },
    data: {
      status,
      completedAt: new Date(),
      actionResultsJson: JSON.stringify(actionResults),
      errorJson: error ? JSON.stringify(error) : null,
    },
  });

  const automation = await prisma.aiOpsAutomationDefinition.findUnique({
    where: { id: automationId },
  });
  if (!automation) return;

  const consecutiveFailures = failed
    ? automation.consecutiveFailures + 1
    : 0;
  const shouldPause =
    failed && consecutiveFailures >= autoPauseThreshold && automation.status === "ACTIVE";

  await prisma.aiOpsAutomationDefinition.update({
    where: { id: automationId },
    data: {
      lastRunAt: new Date(),
      lastRunStatus: status,
      consecutiveFailures,
      ...(shouldPause ? { status: "PAUSED" } : {}),
    },
  });

  await writeAdminAudit({
    organizationId,
    actorId: "system",
    action: "AI_AUTOMATION_RUN_COMPLETED",
    entityType: "AiOpsAutomationExecution",
    entityId: executionId,
    payload: { status, actionCount: actionResults.length, paused: shouldPause },
    category: "SYSTEM",
    severity: failed ? "ERROR" : "INFO",
    outcome: failed ? "FAILURE" : "SUCCESS",
  });
}

export async function continueAfterApproval(input: {
  executionId: string;
  organizationId?: string;
  decidedById: string;
  approve: boolean;
  note?: string;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const execution = await prisma.aiOpsAutomationExecution.findFirst({
    where: { id: input.executionId, organizationId },
    include: { automation: true, approvals: { where: { status: "PENDING" } } },
  });
  if (!execution) return { ok: false as const, error: "Execution not found." };
  if (execution.status !== "WAITING_APPROVAL") {
    return { ok: false as const, error: "Execution is not waiting for approval." };
  }

  const approval = execution.approvals[0];
  if (approval) {
    await prisma.aiOpsAutomationApproval.update({
      where: { id: approval.id },
      data: {
        status: input.approve ? "APPROVED" : "REJECTED",
        decidedById: input.decidedById,
        decidedAt: new Date(),
        decisionNote: input.note ?? null,
      },
    });
  }

  await writeAdminAudit({
    organizationId,
    actorId: input.decidedById,
    action: input.approve
      ? "AI_AUTOMATION_APPROVED"
      : "AI_AUTOMATION_REJECTED",
    entityType: "AiOpsAutomationExecution",
    entityId: execution.id,
    payload: { note: input.note ?? null },
    category: "DATA_CHANGE",
    severity: "INFO",
    outcome: "SUCCESS",
  });

  if (!input.approve) {
    await prisma.aiOpsAutomationExecution.update({
      where: { id: execution.id },
      data: { status: "CANCELLED", completedAt: new Date() },
    });
    return { ok: true as const, status: "CANCELLED" };
  }

  const actions = parseActions(execution.automation.actionsJson);
  const actionResults = await runActions({
    actions,
    payload: execution.inputJson
      ? (JSON.parse(execution.inputJson) as Record<string, unknown>)
      : {},
    dryRun: execution.dryRun,
    failurePolicy: execution.automation.failurePolicy,
  });
  const status = deriveStatus(actionResults);
  await prisma.aiOpsAutomationExecution.update({
    where: { id: execution.id },
    data: {
      status,
      completedAt: new Date(),
      approvedById: input.decidedById,
      approvedAt: new Date(),
      actionResultsJson: JSON.stringify(actionResults),
    },
  });
  await prisma.aiOpsAutomationDefinition.update({
    where: { id: execution.automationId },
    data: {
      lastRunAt: new Date(),
      lastRunStatus: status,
      consecutiveFailures: status === "FAILED" ? undefined : 0,
    },
  });
  return { ok: true as const, status };
}

export async function processAutomationEvent(eventId: string) {
  const event = await prisma.aiOpsAutomationEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === "PROCESSED") return { ok: true, processed: 0 };

  await prisma.aiOpsAutomationEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });

  const trigger = getTrigger(event.eventType);
  if (!trigger?.available) {
    await prisma.aiOpsAutomationEvent.update({
      where: { id: event.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        lastError: "Trigger unavailable",
      },
    });
    return { ok: true, processed: 0 };
  }

  const automations = await prisma.aiOpsAutomationDefinition.findMany({
    where: {
      organizationId: event.organizationId,
      status: "ACTIVE",
      triggerType: { in: ["EVENT", "AI_MONITOR"] },
      eventType: event.eventType,
    },
  });

  let processed = 0;
  const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
  for (const a of automations) {
    await executeAutomation({
      automationId: a.id,
      organizationId: event.organizationId,
      triggerSource: event.eventType,
      triggerReferenceId: event.entityId,
      payload: {
        ...payload,
        entityType: event.entityType,
        entityId: event.entityId,
      },
    });
    processed += 1;
  }

  await prisma.aiOpsAutomationEvent.update({
    where: { id: event.id },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
  return { ok: true, processed };
}

export async function runDueScheduledAutomations(organizationId = DEFAULT_ORG_ID) {
  const now = new Date();
  const due = await prisma.aiOpsAutomationDefinition.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      triggerType: "SCHEDULE",
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    take: 20,
  });

  const results = [];
  for (const a of due) {
    const result = await executeAutomation({
      automationId: a.id,
      organizationId,
      triggerSource: "SCHEDULE",
      triggerReferenceId: hourBucket(now),
      payload: { scheduledAt: now.toISOString(), automationId: a.id },
    });
    const next = computeNextRun(a.scheduleExpression, now);
    await prisma.aiOpsAutomationDefinition.update({
      where: { id: a.id },
      data: { nextRunAt: next },
    });
    results.push({ automationId: a.id, ...result });
  }
  return results;
}

export function computeNextRun(expression: string | null | undefined, from = new Date()): Date {
  const expr = (expression ?? "daily").toLowerCase();
  const next = new Date(from);
  if (expr === "hourly" || expr === "0 * * * *") {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else if (expr === "every_15m") {
    next.setMinutes(next.getMinutes() + 15, 0, 0);
  } else {
    // daily default
    next.setDate(next.getDate() + 1);
    next.setHours(6, 0, 0, 0);
  }
  return next;
}
