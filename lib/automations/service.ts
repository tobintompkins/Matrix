/**
 * Patch 51A.2 — Automation CRUD + overview helpers.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { SYSTEM_TEMPLATES } from "./templates/system-templates";
import { computeNextRun } from "./engine/execute-automation";

export async function ensureAutomationFrameworkSeeded(
  organizationId = DEFAULT_ORG_ID,
) {
  await prisma.aiOpsAutomationSetting.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });

  for (const t of SYSTEM_TEMPLATES) {
    const existing = await prisma.aiOpsAutomationTemplate.findFirst({
      where: { name: t.name, isSystemTemplate: true },
    });
    if (!existing) {
      await prisma.aiOpsAutomationTemplate.create({
        data: {
          name: t.name,
          description: t.description,
          category: t.category,
          icon: t.icon,
          definitionJson: JSON.stringify(t.definition),
          isSystemTemplate: true,
          isActive: true,
        },
      });
    }
  }
}

export async function listAutomations(input: {
  organizationId?: string;
  status?: string;
  q?: string;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  await ensureAutomationFrameworkSeeded(organizationId);
  return prisma.aiOpsAutomationDefinition.findMany({
    where: {
      organizationId,
      ...(input.status ? { status: input.status } : { status: { not: "ARCHIVED" } }),
      ...(input.q
        ? { name: { contains: input.q } }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function getAutomation(id: string, organizationId = DEFAULT_ORG_ID) {
  return prisma.aiOpsAutomationDefinition.findFirst({
    where: { id, organizationId },
  });
}

export async function createAutomation(input: {
  organizationId?: string;
  actorId: string;
  data: {
    name: string;
    description?: string;
    category?: string;
    triggerType: string;
    eventType?: string | null;
    scheduleExpression?: string | null;
    conditionMode?: string;
    conditionsJson?: string;
    actionsJson?: string;
    approvalMode?: string;
    riskLevel?: string;
    dryRunEnabled?: boolean;
    maxRetries?: number;
    retryDelaySeconds?: number;
    timeoutSeconds?: number;
    failurePolicy?: string;
    status?: string;
  };
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const row = await prisma.aiOpsAutomationDefinition.create({
    data: {
      organizationId,
      name: input.data.name.trim().slice(0, 120),
      description: input.data.description?.slice(0, 2000) ?? "",
      category: input.data.category ?? "GENERAL",
      status: input.data.status ?? "DRAFT",
      triggerType: input.data.triggerType,
      eventType: input.data.eventType ?? null,
      scheduleExpression: input.data.scheduleExpression ?? null,
      nextRunAt:
        input.data.triggerType === "SCHEDULE"
          ? computeNextRun(input.data.scheduleExpression)
          : null,
      conditionMode: input.data.conditionMode ?? "ALL",
      conditionsJson: input.data.conditionsJson ?? JSON.stringify({ mode: "ALL", conditions: [] }),
      actionsJson: input.data.actionsJson ?? "[]",
      approvalMode: input.data.approvalMode ?? "BEFORE_HIGH_IMPACT_ACTION",
      riskLevel: input.data.riskLevel ?? "LOW",
      dryRunEnabled: input.data.dryRunEnabled ?? true,
      maxRetries: input.data.maxRetries ?? 1,
      retryDelaySeconds: input.data.retryDelaySeconds ?? 60,
      timeoutSeconds: input.data.timeoutSeconds ?? 120,
      failurePolicy: input.data.failurePolicy ?? "STOP",
      createdById: input.actorId,
      updatedById: input.actorId,
    },
  });
  await writeAdminAudit({
    organizationId,
    actorId: input.actorId,
    action: "AI_AUTOMATION_CREATED",
    entityType: "AiOpsAutomationDefinition",
    entityId: row.id,
    payload: { name: row.name },
    category: "DATA_CHANGE",
    severity: "INFO",
    outcome: "SUCCESS",
  });
  return row;
}

export async function updateAutomation(input: {
  id: string;
  organizationId?: string;
  actorId: string;
  data: Record<string, unknown>;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const existing = await getAutomation(input.id, organizationId);
  if (!existing) return null;

  const allowed = [
    "name",
    "description",
    "category",
    "status",
    "triggerType",
    "eventType",
    "scheduleExpression",
    "conditionMode",
    "conditionsJson",
    "actionsJson",
    "approvalMode",
    "riskLevel",
    "dryRunEnabled",
    "maxRetries",
    "retryDelaySeconds",
    "timeoutSeconds",
    "failurePolicy",
  ] as const;

  const data: Record<string, unknown> = { updatedById: input.actorId };
  for (const key of allowed) {
    if (key in input.data) data[key] = input.data[key];
  }
  if (data.status === "ARCHIVED") data.archivedAt = new Date();
  if (data.triggerType === "SCHEDULE" || existing.triggerType === "SCHEDULE") {
    data.nextRunAt = computeNextRun(
      String(data.scheduleExpression ?? existing.scheduleExpression ?? "daily"),
    );
  }

  const row = await prisma.aiOpsAutomationDefinition.update({
    where: { id: input.id },
    data,
  });
  await writeAdminAudit({
    organizationId,
    actorId: input.actorId,
    action: "AI_AUTOMATION_UPDATED",
    entityType: "AiOpsAutomationDefinition",
    entityId: row.id,
    payload: { fields: Object.keys(input.data) },
    category: "DATA_CHANGE",
    severity: "INFO",
    outcome: "SUCCESS",
  });
  return row;
}

export async function duplicateAutomation(
  id: string,
  actorId: string,
  organizationId = DEFAULT_ORG_ID,
) {
  const src = await getAutomation(id, organizationId);
  if (!src) return null;
  return createAutomation({
    organizationId,
    actorId,
    data: {
      name: `${src.name} (copy)`,
      description: src.description,
      category: src.category,
      triggerType: src.triggerType,
      eventType: src.eventType,
      scheduleExpression: src.scheduleExpression,
      conditionMode: src.conditionMode,
      conditionsJson: src.conditionsJson,
      actionsJson: src.actionsJson,
      approvalMode: src.approvalMode,
      riskLevel: src.riskLevel,
      dryRunEnabled: src.dryRunEnabled,
      maxRetries: src.maxRetries,
      retryDelaySeconds: src.retryDelaySeconds,
      timeoutSeconds: src.timeoutSeconds,
      failurePolicy: src.failurePolicy,
      status: "DRAFT",
    },
  });
}

export async function getAutomationOverview(organizationId = DEFAULT_ORG_ID) {
  await ensureAutomationFrameworkSeeded(organizationId);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [
    active,
    paused,
    runsToday,
    succeededToday,
    failedToday,
    waitingApprovals,
    recent,
    templates,
  ] = await Promise.all([
    prisma.aiOpsAutomationDefinition.count({
      where: { organizationId, status: "ACTIVE" },
    }),
    prisma.aiOpsAutomationDefinition.count({
      where: { organizationId, status: "PAUSED" },
    }),
    prisma.aiOpsAutomationExecution.count({
      where: { organizationId, createdAt: { gte: start } },
    }),
    prisma.aiOpsAutomationExecution.count({
      where: {
        organizationId,
        createdAt: { gte: start },
        status: { in: ["SUCCEEDED", "PARTIALLY_SUCCEEDED"] },
      },
    }),
    prisma.aiOpsAutomationExecution.count({
      where: { organizationId, createdAt: { gte: start }, status: "FAILED" },
    }),
    prisma.aiOpsAutomationApproval.count({
      where: { status: "PENDING", execution: { organizationId } },
    }),
    prisma.aiOpsAutomationExecution.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { automation: { select: { name: true, riskLevel: true } } },
    }),
    prisma.aiOpsAutomationTemplate.findMany({
      where: { isActive: true },
      take: 10,
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    active,
    paused,
    runsToday,
    succeededToday,
    failedToday,
    waitingApprovals,
    aiAssistedRuns: 0,
    actionsExecuted: succeededToday,
    estimatedTimeSavedMinutes: succeededToday * 5,
    recentExecutions: recent,
    templates,
    health:
      failedToday > 3 ? "FAILING" : waitingApprovals > 0 ? "WARNING" : "HEALTHY",
  };
}
