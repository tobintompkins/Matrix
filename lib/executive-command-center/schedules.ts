/**
 * Patch 51A.5 Part 3 Completion — Scheduled jobs (reports, briefing, refreshes).
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { notifyAiOperationsEvent } from "@/lib/ai/notifications";
import { getExecutivePeriodReport } from "./reporting";
import { exportExecutiveReport } from "./export-engine";
import { syncExecutiveAlerts } from "./alerts";
import { buildExecutiveBriefingCenter } from "./briefing-center";
import { recordReportHistory } from "./report-configs";
import { setCachedReport } from "./report-cache";
import type { ExecutiveExportFormat, ExecutiveReportPeriod } from "./reporting-types";

export type ScheduleJobType =
  | "REPORT"
  | "BRIEFING"
  | "KPI_REFRESH"
  | "ALERT_REFRESH"
  | "CACHE_REFRESH";

function nextRunFromPeriod(
  period: "DAILY" | "WEEKLY" | "MONTHLY",
  runHour: number,
  from = new Date(),
): Date {
  const d = new Date(from);
  if (period === "DAILY") d.setDate(d.getDate() + 1);
  else if (period === "WEEKLY") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  d.setHours(Math.min(23, Math.max(0, runHour)), 0, 0, 0);
  return d;
}

export async function listExecutiveSchedules(organizationId = DEFAULT_ORG_ID) {
  return prisma.executiveReportSchedule.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createExecutiveSchedule(input: {
  organizationId?: string;
  name: string;
  period: "DAILY" | "WEEKLY" | "MONTHLY";
  format?: ExecutiveExportFormat;
  recipients?: string[];
  timezone?: string;
  runHour?: number;
  jobType?: ScheduleJobType;
  filters?: Record<string, unknown>;
  createdById?: string | null;
  createdByName?: string | null;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const runHour = input.runHour ?? 6;
  return prisma.executiveReportSchedule.create({
    data: {
      organizationId,
      name: input.name.trim() || `${input.period} executive job`,
      period: input.period,
      format: (input.format ?? "csv").toUpperCase(),
      enabled: true,
      recipientsJson: JSON.stringify(input.recipients ?? []),
      timezone: input.timezone || "America/New_York",
      runHour,
      jobType: input.jobType || "REPORT",
      filtersJson: JSON.stringify(input.filters ?? {}),
      createdById: input.createdById ?? null,
      createdByName: input.createdByName ?? null,
      nextRunAt: nextRunFromPeriod(input.period, runHour),
    },
  });
}

export async function updateExecutiveSchedule(input: {
  id: string;
  organizationId?: string;
  enabled?: boolean;
  name?: string;
  format?: ExecutiveExportFormat;
  recipients?: string[];
  timezone?: string;
  runHour?: number;
  jobType?: ScheduleJobType;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const existing = await prisma.executiveReportSchedule.findFirst({
    where: { id: input.id, organizationId },
  });
  if (!existing) return null;
  return prisma.executiveReportSchedule.update({
    where: { id: input.id },
    data: {
      enabled: input.enabled ?? existing.enabled,
      name: input.name?.trim() || existing.name,
      format: input.format ? input.format.toUpperCase() : existing.format,
      recipientsJson:
        input.recipients != null
          ? JSON.stringify(input.recipients)
          : existing.recipientsJson,
      timezone: input.timezone ?? existing.timezone,
      runHour: input.runHour ?? existing.runHour,
      jobType: input.jobType ?? existing.jobType,
    },
  });
}

export async function deleteExecutiveSchedule(
  id: string,
  organizationId = DEFAULT_ORG_ID,
) {
  const existing = await prisma.executiveReportSchedule.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return false;
  await prisma.executiveReportSchedule.delete({ where: { id } });
  return true;
}

async function runOneSchedule(
  schedule: Awaited<ReturnType<typeof listExecutiveSchedules>>[number],
  organizationId: string,
) {
  const jobType = (schedule.jobType || "REPORT") as ScheduleJobType;
  const period =
    schedule.period === "DAILY" ||
    schedule.period === "WEEKLY" ||
    schedule.period === "MONTHLY"
      ? (schedule.period as ExecutiveReportPeriod)
      : "WEEKLY";

  if (jobType === "ALERT_REFRESH") {
    const result = await syncExecutiveAlerts(organizationId);
    return `Synced ${result.upserted} alert candidate(s)`;
  }

  if (jobType === "BRIEFING") {
    const briefing = await buildExecutiveBriefingCenter({
      organizationId,
      period,
    });
    notifyAiOperationsEvent({
      type: "AI_CRITICAL_INSIGHT",
      title: `Executive briefing ready: ${schedule.name}`,
      message: briefing.briefing.summary.slice(0, 280),
      insightId: schedule.id,
      priority: "NORMAL",
    });
    return `Briefing ${briefing.periodLabel}`;
  }

  if (jobType === "KPI_REFRESH" || jobType === "CACHE_REFRESH") {
    const bundle = await getExecutivePeriodReport({
      organizationId,
      period,
      bypassCache: true,
    });
    await setCachedReport(
      organizationId,
      `period:${period}:p1:s5`,
      bundle,
      60,
    );
    return `KPI/cache refreshed for ${bundle.periodLabel}`;
  }

  // REPORT (default)
  const bundle = await getExecutivePeriodReport({
    organizationId,
    period,
    bypassCache: true,
  });
  const format = (schedule.format.toLowerCase() || "csv") as ExecutiveExportFormat;
  const exported = exportExecutiveReport(bundle, format);
  await recordReportHistory({
    organizationId,
    period: bundle.period,
    format,
    title: schedule.name,
    filename: exported.filename,
    summary: {
      highlights: bundle.highlights,
      scorecards: bundle.scorecards.length,
    },
  });
  notifyAiOperationsEvent({
    type: "AI_CRITICAL_INSIGHT",
    title: `Scheduled report ready: ${schedule.name}`,
    message: `${exported.filename} generated (${bundle.periodLabel}). Open Executive Report Center.`,
    insightId: schedule.id,
    priority: "NORMAL",
  });
  return exported.filename;
}

/** Run due schedules — generates report/briefing/refresh work (no email blast). */
export async function runDueExecutiveSchedules(organizationId = DEFAULT_ORG_ID) {
  const now = new Date();
  const due = await prisma.executiveReportSchedule.findMany({
    where: {
      organizationId,
      enabled: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    take: 20,
  });

  const results: Array<{ id: string; ok: boolean; message: string }> = [];
  for (const schedule of due) {
    try {
      const message = await runOneSchedule(schedule, organizationId);
      await prisma.executiveReportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: nextRunFromPeriod(
            schedule.period as "DAILY" | "WEEKLY" | "MONTHLY",
            schedule.runHour ?? 6,
            now,
          ),
          lastResult: message,
          failureMessage: null,
        },
      });
      results.push({ id: schedule.id, ok: true, message });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Schedule run failed";
      await prisma.executiveReportSchedule
        .update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            failureMessage: message,
            lastResult: "FAILED",
            nextRunAt: nextRunFromPeriod(
              schedule.period as "DAILY" | "WEEKLY" | "MONTHLY",
              schedule.runHour ?? 6,
              now,
            ),
          },
        })
        .catch(() => undefined);
      results.push({ id: schedule.id, ok: false, message });
    }
  }
  return { ran: results.length, results };
}
