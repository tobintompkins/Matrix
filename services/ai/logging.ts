/**
 * Patch 51A.1 — AI request logging helper (every AI request stores audit fields).
 */

import { prisma } from "@/lib/db/prisma";
import type { AiLog } from "@/lib/ai/types";

export type LogAiRequestInput = {
  userId: string;
  sessionId?: string | null;
  requestType: string;
  question: string;
  response: string;
  confidence: number;
  executionTime: number;
  success?: boolean;
  metadata?: Record<string, unknown> | null;
};

function mapLog(row: {
  id: string;
  createdAt: Date;
  userId: string;
  sessionId: string | null;
  requestType: string;
  question: string;
  response: string;
  confidence: number;
  executionTime: number;
  success: boolean;
  metadata: string | null;
}): AiLog {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata) {
    try {
      metadata = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      metadata = { raw: row.metadata };
    }
  }
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    userId: row.userId,
    sessionId: row.sessionId,
    requestType: row.requestType,
    question: row.question,
    response: row.response,
    confidence: row.confidence,
    executionTime: row.executionTime,
    success: row.success,
    metadata,
  };
}

export async function logAiRequest(input: LogAiRequestInput): Promise<AiLog> {
  const row = await prisma.aiOpsLog.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      requestType: input.requestType,
      question: input.question,
      response: input.response,
      confidence: input.confidence,
      executionTime: input.executionTime,
      success: input.success ?? true,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });

  if (input.sessionId) {
    const session = await prisma.aiOpsSession.findUnique({
      where: { id: input.sessionId },
    });
    if (session) {
      const nextCount = session.requestCount + 1;
      const nextAvgConfidence =
        (session.averageConfidence * session.requestCount + input.confidence) /
        nextCount;
      const nextAvgResponse =
        (session.averageResponseTime * session.requestCount +
          input.executionTime) /
        nextCount;
      await prisma.aiOpsSession.update({
        where: { id: input.sessionId },
        data: {
          requestCount: nextCount,
          averageConfidence: nextAvgConfidence,
          averageResponseTime: nextAvgResponse,
          lastActivity: new Date(),
        },
      });
    }
  }

  return mapLog(row);
}

export async function listAiLogs(input: {
  page?: number;
  pageSize?: number;
  userId?: string;
  requestType?: string;
}): Promise<{ items: AiLog[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const where = {
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.requestType ? { requestType: input.requestType } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.aiOpsLog.count({ where }),
    prisma.aiOpsLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items: rows.map(mapLog), total, page, pageSize };
}
