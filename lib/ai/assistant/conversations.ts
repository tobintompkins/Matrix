/**
 * Patch 51A.1 Part 3 — Conversation persistence + ownership checks.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import type { MatrixRole } from "@/lib/auth/types";
import type { AssistantAnswer, AiFeedbackRating } from "./types";
import { AI_FEEDBACK_RATINGS } from "./types";
import { runAssistantQuery } from "./pipeline";
import { aiConfig } from "@/config/ai";

export type ConversationActor = {
  userId: string;
  displayName: string;
  role: MatrixRole;
  organizationId?: string;
};

function canViewAll(actor: ConversationActor) {
  return hasMatrixPermission(actor.role, "VIEW_ALL_AI_CONVERSATIONS");
}

export async function listConversations(input: {
  actor: ConversationActor;
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const where: Record<string, unknown> = {
    organizationId: input.actor.organizationId ?? DEFAULT_ORG_ID,
    status: input.status ?? { not: "DELETED" },
  };
  if (!canViewAll(input.actor)) {
    where.ownerUserId = input.actor.userId;
  }
  if (input.q?.trim()) {
    where.title = { contains: input.q.trim() };
  }
  const [total, rows] = await Promise.all([
    prisma.aiOpsAssistantConversation.count({ where }),
    prisma.aiOpsAssistantConversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    items: rows.map(mapConversation),
    total,
    page,
    pageSize,
  };
}

function mapConversation(row: {
  id: string;
  organizationId: string;
  ownerUserId: string;
  ownerName: string | null;
  title: string;
  status: string;
  contextSummary: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    ownerUserId: row.ownerUserId,
    ownerName: row.ownerName,
    title: row.title,
    status: row.status,
    contextSummary: row.contextSummary,
    messageCount: row.messageCount,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedConversation(
  id: string,
  actor: ConversationActor,
) {
  const row = await prisma.aiOpsAssistantConversation.findFirst({
    where: {
      id,
      organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
      ...(canViewAll(actor) ? {} : { ownerUserId: actor.userId }),
    },
  });
  return row;
}

export async function createConversation(actor: ConversationActor, title?: string) {
  const row = await prisma.aiOpsAssistantConversation.create({
    data: {
      organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
      ownerUserId: actor.userId,
      ownerName: actor.displayName,
      title: title?.trim() || "New conversation",
      status: "ACTIVE",
      providerMeta: JSON.stringify({
        engine: aiConfig.engineName,
        assistantVersion: aiConfig.assistantVersion,
        mode: "deterministic",
      }),
    },
  });
  await writeAdminAudit({
    organizationId: row.organizationId,
    actorId: actor.userId,
    action: "AI_ASSISTANT_CONVERSATION_CREATED",
    entityType: "AiOpsAssistantConversation",
    entityId: row.id,
    payload: { title: row.title },
    category: "SYSTEM",
    severity: "INFO",
    outcome: "SUCCESS",
  });
  return mapConversation(row);
}

export async function getConversation(id: string, actor: ConversationActor) {
  const row = await getOwnedConversation(id, actor);
  if (!row || row.status === "DELETED") return null;
  return mapConversation(row);
}

export async function updateConversation(
  id: string,
  actor: ConversationActor,
  patch: { title?: string; status?: "ACTIVE" | "ARCHIVED" },
) {
  if (!hasMatrixPermission(actor.role, "MANAGE_OWN_AI_CONVERSATIONS")) {
    return { ok: false as const, error: "Permission denied." };
  }
  const row = await getOwnedConversation(id, actor);
  if (!row || row.status === "DELETED") {
    return { ok: false as const, error: "Conversation not found." };
  }
  const data: Record<string, unknown> = {};
  if (patch.title?.trim()) data.title = patch.title.trim().slice(0, 120);
  if (patch.status === "ARCHIVED") {
    data.status = "ARCHIVED";
    data.archivedAt = new Date();
  }
  if (patch.status === "ACTIVE" && row.status === "ARCHIVED") {
    data.status = "ACTIVE";
    data.archivedAt = null;
  }
  const updated = await prisma.aiOpsAssistantConversation.update({
    where: { id },
    data,
  });
  await writeAdminAudit({
    organizationId: updated.organizationId,
    actorId: actor.userId,
    action:
      patch.status === "ARCHIVED"
        ? "AI_ASSISTANT_CONVERSATION_ARCHIVED"
        : patch.status === "ACTIVE"
          ? "AI_ASSISTANT_CONVERSATION_RESTORED"
          : "AI_ASSISTANT_CONVERSATION_RENAMED",
    entityType: "AiOpsAssistantConversation",
    entityId: id,
    payload: patch,
    category: "DATA_CHANGE",
    severity: "INFO",
    outcome: "SUCCESS",
  });
  return { ok: true as const, conversation: mapConversation(updated) };
}

export async function deleteConversation(id: string, actor: ConversationActor) {
  if (
    !hasMatrixPermission(actor.role, "DELETE_AI_CONVERSATIONS") &&
    !hasMatrixPermission(actor.role, "MANAGE_OWN_AI_CONVERSATIONS")
  ) {
    return { ok: false as const, error: "Permission denied." };
  }
  const row = await getOwnedConversation(id, actor);
  if (!row) return { ok: false as const, error: "Conversation not found." };
  await prisma.aiOpsAssistantConversation.update({
    where: { id },
    data: { status: "DELETED", deletedAt: new Date() },
  });
  await writeAdminAudit({
    organizationId: row.organizationId,
    actorId: actor.userId,
    action: "AI_ASSISTANT_CONVERSATION_DELETED",
    entityType: "AiOpsAssistantConversation",
    entityId: id,
    category: "DATA_CHANGE",
    severity: "INFO",
    outcome: "SUCCESS",
  });
  return { ok: true as const };
}

export async function listMessages(id: string, actor: ConversationActor) {
  const row = await getOwnedConversation(id, actor);
  if (!row || row.status === "DELETED") return null;
  const messages = await prisma.aiOpsAssistantMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
    include: { sources: true },
    take: 200,
  });
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    requestType: m.requestType,
    confidence: m.confidence,
    dataBasis: m.dataBasis,
    answerFormat: m.answerFormat,
    limitations: m.limitations,
    retrievalSummary: m.retrievalSummary,
    followUps: m.followUps ? (JSON.parse(m.followUps) as string[]) : [],
    appliedFilters: m.appliedFilters
      ? (JSON.parse(m.appliedFilters) as Record<string, unknown>)
      : {},
    feedbackRating: m.feedbackRating,
    createdAt: m.createdAt.toISOString(),
    sources: m.sources.map((s) => ({
      id: s.id,
      sourceType: s.sourceType,
      recordId: s.recordId,
      displayLabel: s.displayLabel,
      href: s.href,
      fieldSummary: s.fieldSummary,
      timestamp: s.timestamp,
    })),
  }));
}

export async function postUserMessage(input: {
  conversationId: string;
  actor: ConversationActor;
  question: string;
  clarificationValue?: string;
}) {
  if (!hasMatrixPermission(input.actor.role, "USE_AI_ASSISTANT")) {
    return { ok: false as const, error: "Permission denied." };
  }
  const convo = await getOwnedConversation(input.conversationId, input.actor);
  if (!convo || convo.status === "DELETED") {
    return { ok: false as const, error: "Conversation not found." };
  }
  if (convo.status === "ARCHIVED") {
    return { ok: false as const, error: "Conversation is archived. Restore it to continue." };
  }

  const priorFilters = convo.appliedFilters
    ? (JSON.parse(convo.appliedFilters) as AiSearchFilterLike)
    : undefined;

  await prisma.aiOpsAssistantMessage.create({
    data: {
      conversationId: convo.id,
      role: "USER",
      content: input.question.slice(0, aiConfig.assistantMaxQuestionLength),
    },
  });

  await writeAdminAudit({
    organizationId: convo.organizationId,
    actorId: input.actor.userId,
    action: "AI_ASSISTANT_QUESTION_SUBMITTED",
    entityType: "AiOpsAssistantConversation",
    entityId: convo.id,
    payload: { length: input.question.length },
    category: "SYSTEM",
    severity: "INFO",
    outcome: "SUCCESS",
  });

  let answer: AssistantAnswer;
  try {
    answer = await runAssistantQuery({
      actor: {
        userId: input.actor.userId,
        displayName: input.actor.displayName,
        role: input.actor.role,
        organizationId: input.actor.organizationId ?? DEFAULT_ORG_ID,
      },
      question: input.question,
      priorFilters: Array.isArray(priorFilters) ? priorFilters : undefined,
      clarificationValue: input.clarificationValue,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Assistant failed.";
    await writeAdminAudit({
      organizationId: convo.organizationId,
      actorId: input.actor.userId,
      action: "AI_ASSISTANT_ANSWER_FAILED",
      entityType: "AiOpsAssistantConversation",
      entityId: convo.id,
      payload: { error: msg },
      category: "ERROR",
      severity: "ERROR",
      outcome: "FAILURE",
    });
    return { ok: false as const, error: msg };
  }

  const assistantMsg = await prisma.aiOpsAssistantMessage.create({
    data: {
      conversationId: convo.id,
      role: "ASSISTANT",
      content: answer.content,
      requestType: answer.requestType,
      queryPlan: answer.plan ? JSON.stringify(answer.plan) : null,
      appliedFilters: JSON.stringify(answer.appliedFilters),
      confidence: answer.confidence,
      retrievalSummary: answer.retrievalSummary,
      limitations: answer.limitations,
      dataBasis: answer.dataBasis,
      answerFormat: answer.answerFormat,
      followUps: JSON.stringify(answer.followUps),
      providerMeta: JSON.stringify({
        mode: "deterministic",
        assistantVersion: aiConfig.assistantVersion,
      }),
      sources: {
        create: answer.sources.map((s) => ({
          sourceType: s.sourceType,
          recordId: s.recordId,
          displayLabel: s.displayLabel,
          href: s.href,
          fieldSummary: s.fieldSummary,
          timestamp: s.timestamp,
          metadata: s.metadata ? JSON.stringify(s.metadata) : null,
        })),
      },
    },
    include: { sources: true },
  });

  const title =
    convo.messageCount === 0 && convo.title === "New conversation"
      ? input.question.slice(0, 60)
      : convo.title;

  await prisma.aiOpsAssistantConversation.update({
    where: { id: convo.id },
    data: {
      title,
      messageCount: { increment: 2 },
      lastMessageAt: new Date(),
      contextSummary: answer.retrievalSummary?.slice(0, 400) ?? null,
      appliedFilters: JSON.stringify(answer.plan?.filters ?? []),
    },
  });

  await writeAdminAudit({
    organizationId: convo.organizationId,
    actorId: input.actor.userId,
    action: "AI_ASSISTANT_ANSWER_COMPLETED",
    entityType: "AiOpsAssistantMessage",
    entityId: assistantMsg.id,
    payload: {
      requestType: answer.requestType,
      sourceCount: answer.sources.length,
      modules: answer.plan?.modules ?? [],
    },
    category: "SYSTEM",
    severity: "INFO",
    outcome: "SUCCESS",
  });

  return {
    ok: true as const,
    answer,
    messageId: assistantMsg.id,
    sources: assistantMsg.sources,
  };
}

type AiSearchFilterLike = unknown;

export async function submitFeedback(input: {
  actor: ConversationActor;
  conversationId: string;
  messageId: string;
  rating: string;
  comment?: string;
}) {
  if (!AI_FEEDBACK_RATINGS.includes(input.rating as AiFeedbackRating)) {
    return { ok: false as const, error: "Invalid feedback rating." };
  }
  const convo = await getOwnedConversation(input.conversationId, input.actor);
  if (!convo) return { ok: false as const, error: "Conversation not found." };
  const msg = await prisma.aiOpsAssistantMessage.findFirst({
    where: { id: input.messageId, conversationId: input.conversationId },
  });
  if (!msg) return { ok: false as const, error: "Message not found." };

  await prisma.aiOpsAssistantFeedback.create({
    data: {
      conversationId: input.conversationId,
      messageId: input.messageId,
      userId: input.actor.userId,
      rating: input.rating,
      comment: input.comment?.slice(0, 500) ?? null,
    },
  });
  await prisma.aiOpsAssistantMessage.update({
    where: { id: input.messageId },
    data: {
      feedbackRating: input.rating,
      feedbackComment: input.comment?.slice(0, 500) ?? null,
    },
  });
  await writeAdminAudit({
    organizationId: convo.organizationId,
    actorId: input.actor.userId,
    action: "AI_ASSISTANT_FEEDBACK_SUBMITTED",
    entityType: "AiOpsAssistantMessage",
    entityId: input.messageId,
    payload: { rating: input.rating },
    category: "SYSTEM",
    severity: "INFO",
    outcome: "SUCCESS",
  });
  return { ok: true as const };
}

export function getSuggestions() {
  return [
    "Show me all overdue PMs at SFX/MPX.",
    "Which machines have had the most repeat service calls this month?",
    "What parts are running low?",
    "Summarize open critical service calls.",
    "Show all unresolved AI insights.",
    "Which technicians have the highest open workload?",
    "Find service calls that mention paper jams.",
    "What can you help with?",
  ];
}
