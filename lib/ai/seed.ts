/**
 * Patch 51A.1 — Idempotent AI Operations Center demo seed.
 */

import { prisma } from "@/lib/db/prisma";
import { aiConfig } from "@/config/ai";

export async function ensureAiCenterSeeded(): Promise<{ seeded: boolean }> {
  const existingRecs = await prisma.aiOpsRecommendation.count();
  if (existingRecs > 0) {
    return { seeded: false };
  }

  const now = new Date();

  await prisma.aiOpsRecommendation.createMany({
    data: [
      {
        title: "Three PMs due soon",
        description:
          "Three preventive maintenance visits are due within the next 72 hours across SFX sites.",
        priority: "HIGH",
        category: "PM",
        completed: false,
        confidence: 96,
      },
      {
        title: "Black Ink inventory low",
        description:
          "Primary warehouse black ink is below reorder threshold. Open a replenishment approval if required.",
        priority: "HIGH",
        category: "INVENTORY",
        completed: false,
        confidence: 97,
      },
      {
        title: "Repeat service trend detected",
        description:
          "ComColor units show elevated repeat-call rate over the last 14 days.",
        priority: "MEDIUM",
        category: "SERVICE",
        completed: false,
        confidence: 92,
      },
      {
        title: "Valezus fleet utilization high",
        description:
          "Valezus segment utilization exceeds planning baseline. Review capacity and PM windows.",
        priority: "MEDIUM",
        category: "FLEET",
        completed: false,
        confidence: 94,
      },
    ],
  });

  await prisma.aiOpsPrediction.createMany({
    data: [
      {
        predictionType: "SERVICE_VOLUME",
        title: "Service Calls Today",
        description: "Predicted inbound service call volume for today.",
        confidence: 93,
        priority: "MEDIUM",
        status: "OPEN",
        recommendedAction: "Confirm dispatch coverage for afternoon peak.",
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
      {
        predictionType: "PM_DUE",
        title: "PM Due",
        description: "Machines predicted to enter PM window this week.",
        confidence: 95,
        priority: "HIGH",
        status: "OPEN",
        recommendedAction: "Pre-stage PM kits for six units.",
        expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        predictionType: "INVENTORY_RISK",
        title: "Inventory Alerts",
        description: "Parts predicted to breach safety stock.",
        confidence: 97,
        priority: "HIGH",
        status: "OPEN",
        recommendedAction: "Review black ink and fuser kits.",
        expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  await prisma.aiOpsMetric.createMany({
    data: [
      {
        metricName: "service_calls_today",
        metricValue: 23,
        metricUnit: "count",
      },
      { metricName: "pm_due", metricValue: 6, metricUnit: "count" },
      { metricName: "inventory_alerts", metricValue: 2, metricUnit: "count" },
      {
        metricName: "average_response_time_ms",
        metricValue: 210,
        metricUnit: "ms",
      },
      {
        metricName: "confidence_pct",
        metricValue: aiConfig.defaultConfidence,
        metricUnit: "percent",
      },
    ],
  });

  await prisma.aiOpsNotification.createMany({
    data: [
      {
        title: "AI Operations Center online",
        message: `${aiConfig.version} foundation is ready. Chat remains stubbed until a later patch.`,
        severity: "INFO",
        read: false,
        category: "SYSTEM",
        actionUrl: "/ai",
      },
      {
        title: "Inventory risk signal",
        message: "Black ink inventory low — review recommendations.",
        severity: "WARNING",
        read: false,
        category: "INVENTORY",
        actionUrl: "/admin/inventory",
      },
    ],
  });

  await prisma.aiOpsLearning.create({
    data: {
      source: "initial-enterprise-seed",
      recordsProcessed: 512,
      status: "COMPLETED",
      duration: 420,
      notes: "Initial demo learning snapshot for Matrix AI Core 1.0",
    },
  });

  await prisma.aiOpsSession.create({
    data: {
      userId: "system-seed",
      sessionName: "Foundation seed session",
      status: "CLOSED",
      requestCount: 1,
      averageConfidence: aiConfig.defaultConfidence,
      averageResponseTime: 210,
      lastActivity: now,
    },
  });

  return { seeded: true };
}
