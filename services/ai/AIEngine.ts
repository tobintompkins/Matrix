/**
 * Patch 51A.1 — Central AI Engine orchestrator.
 * No UI logic. Controllers call this; services return typed DTOs.
 * External LLM providers are intentionally not connected.
 */

import type {
  AiChatRequest,
  AiChatResponse,
  AiFleetInsight,
  AiHealth,
  AiInsight,
  AiLearningRun,
  AiLog,
  AiMetric,
  AiPrediction,
  AiRecommendation,
  AiStatus,
  AiSummary,
} from "@/lib/ai/types";
import { aiChatService } from "./AIChatService";
import { aiFleetService } from "./AIFleetService";
import { aiHealthService } from "./AIHealthService";
import { aiInsightService } from "./AIInsightService";
import { aiLearningService } from "./AILearningService";
import { aiMetricsService } from "./AIMetricsService";
import { aiRecommendationService } from "./AIRecommendationService";
import { listAiLogs } from "./logging";

export class AIEngine {
  async status(userId?: string): Promise<AiStatus> {
    return aiHealthService.getStatus(userId);
  }

  async health(userId?: string): Promise<AiHealth> {
    return aiHealthService.getHealth(userId);
  }

  async summary(userId?: string): Promise<AiSummary> {
    return aiInsightService.getTodaysSummary(userId);
  }

  async recommendations(userId?: string): Promise<AiRecommendation[]> {
    return aiRecommendationService.list({ userId });
  }

  async predictions(userId?: string): Promise<AiPrediction[]> {
    return aiInsightService.listPredictions(userId);
  }

  async metrics(userId?: string): Promise<AiMetric[]> {
    return aiMetricsService.listLatest(userId);
  }

  async metricCards(userId?: string) {
    return aiMetricsService.getSummaryCards(userId);
  }

  async logs(input: {
    page?: number;
    pageSize?: number;
    userId?: string;
    requestType?: string;
  }): Promise<{ items: AiLog[]; total: number; page: number; pageSize: number }> {
    return listAiLogs(input);
  }

  async chat(input: AiChatRequest): Promise<AiChatResponse> {
    return aiChatService.ask(input);
  }

  async fleet(userId?: string): Promise<AiFleetInsight[]> {
    return aiFleetService.analyze(userId);
  }

  async insights(): Promise<AiInsight[]> {
    return aiInsightService.listInsights();
  }

  async learningHistory(): Promise<AiLearningRun[]> {
    return aiLearningService.listRecent();
  }
}

export const aiEngine = new AIEngine();
