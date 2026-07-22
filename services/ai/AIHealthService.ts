/**
 * Patch 51A.1 — AI health / status service.
 */

import { aiConfig } from "@/config/ai";
import type { AiHealth, AiStatus } from "@/lib/ai/types";
import { logAiRequest } from "./logging";

const startedAt = Date.now();

export class AIHealthService {
  getUptimeSeconds(): number {
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  async getStatus(userId?: string): Promise<AiStatus> {
    const started = Date.now();
    const status: AiStatus = {
      online: aiConfig.enabled,
      version: aiConfig.version,
      uptime: this.getUptimeSeconds(),
      learningEnabled: aiConfig.learningEnabled,
      confidence: aiConfig.defaultConfidence,
      responseTime: 210,
      chatEnabled: aiConfig.chatEnabled,
      predictionEngineEnabled: aiConfig.predictionEngineEnabled,
      recommendationsEnabled: aiConfig.recommendationsEnabled,
    };
    if (userId) {
      await logAiRequest({
        userId,
        requestType: "STATUS",
        question: "AI status",
        response: JSON.stringify(status),
        confidence: aiConfig.defaultConfidence,
        executionTime: Date.now() - started,
      });
    }
    return status;
  }

  async getHealth(userId?: string): Promise<AiHealth> {
    const started = Date.now();
    const health: AiHealth = {
      status: aiConfig.enabled ? "HEALTHY" : "OFFLINE",
      checks: [
        {
          name: "engine",
          ok: aiConfig.enabled,
          detail: aiConfig.enabled ? "AI Engine online" : "AI disabled",
        },
        {
          name: "learning",
          ok: aiConfig.learningEnabled,
          detail: aiConfig.learningEnabled
            ? "Learning pipeline enabled (demo)"
            : "Learning disabled",
        },
        {
          name: "predictions",
          ok: aiConfig.predictionEngineEnabled,
          detail: "Prediction engine ready (seeded)",
        },
        {
          name: "chat",
          ok: true,
          detail: aiConfig.chatEnabled
            ? "Chat enabled"
            : "Chat stubbed — provider not connected",
        },
      ],
      lastCheckedAt: new Date().toISOString(),
    };
    if (userId) {
      await logAiRequest({
        userId,
        requestType: "HEALTH",
        question: "AI health check",
        response: health.status,
        confidence: aiConfig.defaultConfidence,
        executionTime: Date.now() - started,
      });
    }
    return health;
  }
}

export const aiHealthService = new AIHealthService();
