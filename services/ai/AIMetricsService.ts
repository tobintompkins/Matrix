/**
 * Patch 51A.1 — AI metrics service.
 */

import { prisma } from "@/lib/db/prisma";
import type { AiMetric } from "@/lib/ai/types";
import { aiConfig } from "@/config/ai";
import { logAiRequest } from "./logging";

function mapMetric(row: {
  id: string;
  createdAt: Date;
  metricName: string;
  metricValue: number;
  metricUnit: string;
}): AiMetric {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    metricName: row.metricName,
    metricValue: row.metricValue,
    metricUnit: row.metricUnit,
  };
}

export class AIMetricsService {
  async listLatest(userId?: string): Promise<AiMetric[]> {
    const started = Date.now();
    const names = [
      "service_calls_today",
      "pm_due",
      "inventory_alerts",
      "average_response_time_ms",
      "confidence_pct",
    ];
    const items: AiMetric[] = [];
    for (const name of names) {
      const row = await prisma.aiOpsMetric.findFirst({
        where: { metricName: name },
        orderBy: { createdAt: "desc" },
      });
      if (row) items.push(mapMetric(row));
    }
    if (userId) {
      await logAiRequest({
        userId,
        requestType: "METRICS",
        question: "Fetch AI dashboard metrics",
        response: JSON.stringify({ count: items.length }),
        confidence: aiConfig.defaultConfidence,
        executionTime: Date.now() - started,
      });
    }
    return items;
  }

  async getSummaryCards(userId?: string): Promise<{
    serviceCallsToday: number;
    pmDue: number;
    inventoryAlerts: number;
    averageResponseTimeMs: number;
  }> {
    const metrics = await this.listLatest(userId);
    const value = (name: string, fallback: number) =>
      metrics.find((m) => m.metricName === name)?.metricValue ?? fallback;
    return {
      serviceCallsToday: value("service_calls_today", 23),
      pmDue: value("pm_due", 6),
      inventoryAlerts: value("inventory_alerts", 2),
      averageResponseTimeMs: value("average_response_time_ms", 210),
    };
  }
}

export const aiMetricsService = new AIMetricsService();
