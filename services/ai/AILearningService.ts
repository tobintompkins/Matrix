/**
 * Patch 51A.1 — AI learning service (seeded runs; no model training yet).
 */

import { prisma } from "@/lib/db/prisma";
import type { AiLearningRun } from "@/lib/ai/types";
import { aiConfig } from "@/config/ai";
import { logAiRequest } from "./logging";

function mapRun(row: {
  id: string;
  createdAt: Date;
  source: string;
  recordsProcessed: number;
  status: string;
  duration: number;
  notes: string | null;
}): AiLearningRun {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    source: row.source,
    recordsProcessed: row.recordsProcessed,
    status: row.status as AiLearningRun["status"],
    duration: row.duration,
    notes: row.notes,
  };
}

export class AILearningService {
  isEnabled(): boolean {
    return aiConfig.learningEnabled;
  }

  async listRecent(limit = 20): Promise<AiLearningRun[]> {
    const rows = await prisma.aiOpsLearning.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(mapRun);
  }

  async recordDemoCycle(userId: string): Promise<AiLearningRun> {
    const started = Date.now();
    const row = await prisma.aiOpsLearning.create({
      data: {
        source: "enterprise-demo-cycle",
        recordsProcessed: 128,
        status: "COMPLETED",
        duration: 210,
        notes: "Demo learning cycle — no external model training performed.",
      },
    });
    await logAiRequest({
      userId,
      requestType: "LEARNING",
      question: "Run demo learning cycle",
      response: `Processed ${row.recordsProcessed} records`,
      confidence: aiConfig.defaultConfidence,
      executionTime: Date.now() - started,
    });
    return mapRun(row);
  }
}

export const aiLearningService = new AILearningService();
