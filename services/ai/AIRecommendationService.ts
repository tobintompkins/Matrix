/**
 * Patch 51A.1 — AI recommendation service (seeded / DB-backed; no LLM).
 */

import { prisma } from "@/lib/db/prisma";
import type { AiRecommendation } from "@/lib/ai/types";
import { aiConfig } from "@/config/ai";
import { logAiRequest } from "./logging";

function mapRec(row: {
  id: string;
  createdAt: Date;
  title: string;
  description: string;
  priority: string;
  category: string;
  completed: boolean;
  confidence: number;
}): AiRecommendation {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    title: row.title,
    description: row.description,
    priority: row.priority as AiRecommendation["priority"],
    category: row.category,
    completed: row.completed,
    confidence: row.confidence,
  };
}

export class AIRecommendationService {
  async list(input?: {
    includeCompleted?: boolean;
    userId?: string;
  }): Promise<AiRecommendation[]> {
    if (!aiConfig.recommendationsEnabled) return [];
    const started = Date.now();
    const rows = await prisma.aiOpsRecommendation.findMany({
      where: input?.includeCompleted ? undefined : { completed: false },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    const items = rows.map(mapRec);
    if (input?.userId) {
      await logAiRequest({
        userId: input.userId,
        requestType: "RECOMMENDATIONS",
        question: "List AI recommendations",
        response: JSON.stringify({ count: items.length }),
        confidence: aiConfig.defaultConfidence,
        executionTime: Date.now() - started,
        metadata: { count: items.length },
      });
    }
    return items;
  }
}

export const aiRecommendationService = new AIRecommendationService();
