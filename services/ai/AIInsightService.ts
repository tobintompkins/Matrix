/**
 * Patch 51A.1 — AI insight / summary service (seeded enterprise summary).
 */

import { prisma } from "@/lib/db/prisma";
import { aiConfig } from "@/config/ai";
import type { AiInsight, AiPrediction, AiSummary } from "@/lib/ai/types";
import { logAiRequest } from "./logging";
import { aiMetricsService } from "./AIMetricsService";

function mapPrediction(row: {
  id: string;
  createdAt: Date;
  predictionType: string;
  title: string;
  description: string;
  confidence: number;
  priority: string;
  status: string;
  recommendedAction: string;
  expiresAt: Date | null;
}): AiPrediction {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    predictionType: row.predictionType,
    title: row.title,
    description: row.description,
    confidence: row.confidence,
    priority: row.priority as AiPrediction["priority"],
    status: row.status as AiPrediction["status"],
    recommendedAction: row.recommendedAction,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}

export class AIInsightService {
  async getTodaysSummary(userId?: string): Promise<AiSummary> {
    const started = Date.now();
    const cards = await aiMetricsService.getSummaryCards();
    const summary: AiSummary = {
      title: "Today's Summary",
      serviceCalls: cards.serviceCallsToday,
      completedPms: 11,
      inventoryAlerts: cards.inventoryAlerts,
      averageTechnicianUtilization: 78,
      openIncidents: 4,
      generatedAt: new Date().toISOString(),
    };
    if (userId) {
      await logAiRequest({
        userId,
        requestType: "SUMMARY",
        question: "Today's AI operations summary",
        response: JSON.stringify(summary),
        confidence: aiConfig.defaultConfidence,
        executionTime: Date.now() - started,
      });
    }
    return summary;
  }

  async listPredictions(userId?: string): Promise<AiPrediction[]> {
    if (!aiConfig.predictionEngineEnabled) return [];
    const started = Date.now();
    const rows = await prisma.aiOpsPrediction.findMany({
      where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    const items = rows.map(mapPrediction);
    if (userId) {
      await logAiRequest({
        userId,
        requestType: "PREDICTIONS",
        question: "List AI predictions",
        response: JSON.stringify({ count: items.length }),
        confidence: aiConfig.defaultConfidence,
        executionTime: Date.now() - started,
      });
    }
    return items;
  }

  async listInsights(): Promise<AiInsight[]> {
    return [
      {
        id: "insight-pm-window",
        title: "PM window concentration",
        body: "Six PMs are clustered in the next 7 days across SFX/MPX.",
        category: "PM",
        confidence: 96,
      },
      {
        id: "insight-ink",
        title: "Black ink pressure",
        body: "Black ink inventory is below reorder threshold at primary warehouse.",
        category: "INVENTORY",
        confidence: 97,
      },
    ];
  }
}

export const aiInsightService = new AIInsightService();
