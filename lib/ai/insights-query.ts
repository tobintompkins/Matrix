/**
 * Patch 51A.1 Part 2 — Insight query / list / get.
 */

import { prisma } from "@/lib/db/prisma";
import { mapInsight } from "./insight-workflow";
import type { AiOpsInsightDto } from "./insight-types";

export type InsightListQuery = {
  organizationId: string;
  severity?: string;
  status?: string;
  sourceModule?: string;
  insightType?: string;
  customer?: string;
  site?: string;
  machine?: string;
  assignedReviewerId?: string;
  minConfidence?: number;
  maxConfidence?: number;
  q?: string;
  sort?:
    | "severity"
    | "confidence"
    | "newest"
    | "oldest"
    | "updated";
  page?: number;
  pageSize?: number;
};

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export async function listAiInsights(
  query: InsightListQuery,
): Promise<{ items: AiOpsInsightDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));

  const where: Record<string, unknown> = {
    organizationId: query.organizationId,
  };
  if (query.severity) where.severity = query.severity;
  if (query.status) where.status = query.status;
  if (query.sourceModule) where.sourceModule = query.sourceModule;
  if (query.insightType) where.insightType = query.insightType;
  if (query.assignedReviewerId) where.assignedReviewerId = query.assignedReviewerId;
  if (query.customer) {
    where.customerName = { contains: query.customer };
  }
  if (query.site) where.siteName = { contains: query.site };
  if (query.machine) {
    where.OR = [
      { machineLabel: { contains: query.machine } },
      { machineId: { contains: query.machine } },
    ];
  }
  if (query.minConfidence != null || query.maxConfidence != null) {
    where.confidence = {
      ...(query.minConfidence != null ? { gte: query.minConfidence } : {}),
      ...(query.maxConfidence != null ? { lte: query.maxConfidence } : {}),
    };
  }
  if (query.q?.trim()) {
    const q = query.q.trim();
    where.AND = [
      {
        OR: [
          { title: { contains: q } },
          { summary: { contains: q } },
          { recommendedAction: { contains: q } },
          { customerName: { contains: q } },
          { machineLabel: { contains: q } },
        ],
      },
    ];
  }

  const rows = await prisma.aiOpsInsight.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  let mapped = rows.map(mapInsight);
  switch (query.sort) {
    case "severity":
      mapped = [...mapped].sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0),
      );
      break;
    case "confidence":
      mapped = [...mapped].sort((a, b) => b.confidence - a.confidence);
      break;
    case "oldest":
      mapped = [...mapped].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      break;
    case "updated":
      mapped = [...mapped].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      break;
    case "newest":
    default:
      mapped = [...mapped].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
  }

  const total = mapped.length;
  const start = (page - 1) * pageSize;
  return {
    items: mapped.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export async function getAiInsight(
  id: string,
  organizationId: string,
): Promise<AiOpsInsightDto | null> {
  const row = await prisma.aiOpsInsight.findFirst({
    where: { id, organizationId },
  });
  return row ? mapInsight(row) : null;
}
