/**
 * Patch 51A.5 Part 3 Completion — saved report configs + history.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { ExecutiveExportFormat } from "./reporting-types";

export async function listReportConfigs(organizationId = DEFAULT_ORG_ID) {
  return prisma.executiveReportConfig.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function saveReportConfig(input: {
  organizationId?: string;
  name: string;
  period: string;
  format?: ExecutiveExportFormat;
  filters?: Record<string, unknown>;
  sections?: string[];
  createdById?: string | null;
  createdByName?: string | null;
}) {
  return prisma.executiveReportConfig.create({
    data: {
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      name: input.name.trim() || "Saved report",
      period: input.period,
      format: (input.format ?? "csv").toUpperCase(),
      filtersJson: JSON.stringify(input.filters ?? {}),
      sectionsJson: JSON.stringify(input.sections ?? []),
      createdById: input.createdById ?? null,
      createdByName: input.createdByName ?? null,
    },
  });
}

export async function deleteReportConfig(
  id: string,
  organizationId = DEFAULT_ORG_ID,
) {
  const row = await prisma.executiveReportConfig.findFirst({
    where: { id, organizationId },
  });
  if (!row) return false;
  await prisma.executiveReportConfig.delete({ where: { id } });
  return true;
}

export async function listReportHistory(organizationId = DEFAULT_ORG_ID) {
  return prisma.executiveReportHistory.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function recordReportHistory(input: {
  organizationId?: string;
  period: string;
  format: string;
  title: string;
  filters?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  filename?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
}) {
  return prisma.executiveReportHistory.create({
    data: {
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      period: input.period,
      format: input.format,
      title: input.title,
      filtersJson: JSON.stringify(input.filters ?? {}),
      summaryJson: JSON.stringify(input.summary ?? {}),
      filename: input.filename ?? null,
      createdById: input.createdById ?? null,
      createdByName: input.createdByName ?? null,
    },
  });
}
