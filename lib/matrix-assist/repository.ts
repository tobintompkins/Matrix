import { prisma } from "@/lib/db/prisma";
import type {
  DiagnosticSessionStatus,
  FeedbackRating,
  StepResult,
} from "./types";
import { GENERIC_TROUBLESHOOTING_TEMPLATES } from "./templates";

export type CreateSessionInput = {
  organizationId?: string | null;
  serviceCallId?: string | null;
  machineId?: string | null;
  customerId?: string | null;
  technicianId?: string | null;
  technicianName?: string | null;
  reportedSymptom?: string | null;
  technicianObservations?: string | null;
  modelHint?: string | null;
  errorCode?: string | null;
};

export async function createDiagnosticSession(input: CreateSessionInput) {
  return prisma.matrixAssistDiagnosticSession.create({
    data: {
      organizationId: input.organizationId ?? null,
      serviceCallId: input.serviceCallId ?? null,
      machineId: input.machineId ?? null,
      customerId: input.customerId ?? null,
      technicianId: input.technicianId ?? null,
      technicianName: input.technicianName ?? null,
      status: "DRAFT",
      reportedSymptom: input.reportedSymptom ?? null,
      technicianObservations: input.technicianObservations ?? null,
      modelHint: input.modelHint ?? null,
      errorCode: input.errorCode ?? null,
      workflowStep: 1,
    },
  });
}

export async function getDiagnosticSession(id: string) {
  return prisma.matrixAssistDiagnosticSession.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { stepOrder: "asc" } },
      messages: { orderBy: { createdAt: "asc" } },
      feedback: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listDiagnosticSessions(input: {
  technicianId?: string | null;
  teamView?: boolean;
  organizationId?: string | null;
  limit?: number;
}) {
  const where: {
    organizationId?: string;
    technicianId?: string;
    status?: { not: string };
  } = {};
  if (input.organizationId) where.organizationId = input.organizationId;
  if (!input.teamView && input.technicianId) {
    where.technicianId = input.technicianId;
  }
  return prisma.matrixAssistDiagnosticSession.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: input.limit ?? 20,
  });
}

export async function updateSessionStatus(
  id: string,
  status: DiagnosticSessionStatus,
  extra?: { technicianConclusion?: string; assistantSummary?: string },
) {
  return prisma.matrixAssistDiagnosticSession.update({
    where: { id },
    data: {
      status,
      technicianConclusion: extra?.technicianConclusion,
      assistantSummary: extra?.assistantSummary,
      completedAt: status === "COMPLETED" ? new Date() : undefined,
    },
  });
}

export async function replaceInspectionSteps(
  sessionId: string,
  checks: Array<{ title: string; instructions: string }>,
) {
  await prisma.matrixAssistDiagnosticStep.deleteMany({
    where: { diagnosticSessionId: sessionId },
  });
  if (checks.length === 0) return [];
  await prisma.matrixAssistDiagnosticStep.createMany({
    data: checks.map((c, i) => ({
      diagnosticSessionId: sessionId,
      stepOrder: i + 1,
      title: c.title,
      instructions: c.instructions,
      result: "NOT_STARTED",
    })),
  });
  return prisma.matrixAssistDiagnosticStep.findMany({
    where: { diagnosticSessionId: sessionId },
    orderBy: { stepOrder: "asc" },
  });
}

export async function updateStepResult(input: {
  stepId: string;
  result: StepResult;
  technicianNote?: string | null;
}) {
  return prisma.matrixAssistDiagnosticStep.update({
    where: { id: input.stepId },
    data: {
      result: input.result,
      technicianNote: input.technicianNote ?? undefined,
    },
  });
}

export async function addMessage(input: {
  organizationId?: string | null;
  diagnosticSessionId: string;
  serviceCallId?: string | null;
  machineId?: string | null;
  userId?: string | null;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
}) {
  return prisma.matrixAssistMessage.create({
    data: {
      organizationId: input.organizationId ?? null,
      diagnosticSessionId: input.diagnosticSessionId,
      serviceCallId: input.serviceCallId ?? null,
      machineId: input.machineId ?? null,
      userId: input.userId ?? null,
      role: input.role,
      content: input.content.slice(0, 8000),
    },
  });
}

export async function saveSuggestedCauses(
  sessionId: string,
  causesJson: string,
  summary?: string,
) {
  return prisma.matrixAssistDiagnosticSession.update({
    where: { id: sessionId },
    data: {
      suggestedCausesJson: causesJson,
      assistantSummary: summary,
      status: "IN_PROGRESS",
      workflowStep: 4,
    },
  });
}

export async function addFeedback(input: {
  organizationId?: string | null;
  diagnosticSessionId: string;
  messageId?: string | null;
  userId?: string | null;
  rating: FeedbackRating;
  reason?: string | null;
  comment?: string | null;
}) {
  return prisma.matrixAssistFeedback.create({
    data: {
      organizationId: input.organizationId ?? null,
      diagnosticSessionId: input.diagnosticSessionId,
      messageId: input.messageId ?? null,
      userId: input.userId ?? null,
      rating: input.rating,
      reason: input.reason ?? null,
      comment: input.comment ?? null,
    },
  });
}

export async function recordUsageEvent(input: {
  organizationId?: string | null;
  userId?: string | null;
  eventType: string;
  durationMs?: number;
  tokenUsage?: number;
  errorCode?: string;
}) {
  return prisma.matrixAssistUsageEvent.create({
    data: {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      eventType: input.eventType,
      durationMs: input.durationMs ?? null,
      tokenUsage: input.tokenUsage ?? null,
      errorCode: input.errorCode ?? null,
    },
  });
}

export async function getOrCreateSettings(organizationId?: string | null) {
  const orgId = organizationId ?? "default";
  const existing = await prisma.matrixAssistSettings.findFirst({
    where: { organizationId: orgId },
  });
  if (existing) return existing;
  return prisma.matrixAssistSettings.create({
    data: { organizationId: orgId },
  });
}

export async function updateSettings(
  organizationId: string | null | undefined,
  data: Partial<{
    enabled: boolean;
    allowHistorySummaries: boolean;
    allowPartsSuggestions: boolean;
    allowServiceNoteDrafts: boolean;
    allowTroubleshootingTemplates: boolean;
    requireFeedbackOnComplete: boolean;
    maxResponseLength: number;
    conversationRetentionDays: number;
    approvedModel: string | null;
    disclaimerOverride: string | null;
    updatedBy: string | null;
  }>,
) {
  const current = await getOrCreateSettings(organizationId);
  return prisma.matrixAssistSettings.update({
    where: { id: current.id },
    data,
  });
}

export async function ensureTemplatesSeeded() {
  const count = await prisma.troubleshootingTemplate.count();
  if (count > 0) return count;
  for (const t of GENERIC_TROUBLESHOOTING_TEMPLATES) {
    await prisma.troubleshootingTemplate.create({
      data: {
        printerModel: t.printerModel ?? null,
        machineFamily: t.machineFamily ?? null,
        symptomCategory: t.symptomCategory,
        errorCode: t.errorCode ?? null,
        assembly: t.assembly ?? null,
        title: t.title,
        safetyNotes: t.safetyNotes,
        stepsJson: JSON.stringify(t.steps),
        relatedPartsJson: JSON.stringify(t.relatedParts),
        active: true,
        version: 1,
      },
    });
  }
  return GENERIC_TROUBLESHOOTING_TEMPLATES.length;
}

export async function listTemplates(activeOnly = true) {
  await ensureTemplatesSeeded();
  return prisma.troubleshootingTemplate.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ symptomCategory: "asc" }, { title: "asc" }],
  });
}

export async function writeAssistAudit(input: {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: "MatrixAssist",
      entityId: input.entityId ?? null,
      payload: input.payload ? JSON.stringify(input.payload) : null,
    },
  });
}
