import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  createExecutiveSchedule,
  deleteExecutiveSchedule,
  listExecutiveSchedules,
  runDueExecutiveSchedules,
  updateExecutiveSchedule,
} from "@/lib/executive-command-center/schedules";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { ExecutiveExportFormat } from "@/lib/executive-command-center/reporting-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_REPORTS");
  if (denied) return denied;
  const items = await listExecutiveSchedules(DEFAULT_ORG_ID);
  return NextResponse.json({
    ok: true,
    items: items.map((s) => ({
      ...s,
      recipients: JSON.parse(s.recipientsJson || "[]"),
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      lastRunAt: s.lastRunAt?.toISOString() ?? null,
      nextRunAt: s.nextRunAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_EXECUTIVE_REPORT_SCHEDULES");
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (body.action === "runDue") {
    const result = await runDueExecutiveSchedules(DEFAULT_ORG_ID);
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.action === "delete" && typeof body.id === "string") {
    const ok = await deleteExecutiveSchedule(body.id, DEFAULT_ORG_ID);
    return NextResponse.json({ ok });
  }

  if (body.action === "update" && typeof body.id === "string") {
    const updated = await updateExecutiveSchedule({
      id: body.id,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      format:
        typeof body.format === "string"
          ? (body.format as ExecutiveExportFormat)
          : undefined,
    });
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Schedule not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, item: updated });
  }

  const period = String(body.period || "WEEKLY").toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(period)) {
    return NextResponse.json(
      { ok: false, error: "period must be DAILY, WEEKLY, or MONTHLY." },
      { status: 400 },
    );
  }

  const jobTypeRaw = String(body.jobType || "REPORT").toUpperCase();
  const allowedJobs = [
    "REPORT",
    "BRIEFING",
    "KPI_REFRESH",
    "ALERT_REFRESH",
    "CACHE_REFRESH",
  ] as const;
  type Job = (typeof allowedJobs)[number];
  const jobType: Job = (allowedJobs as readonly string[]).includes(jobTypeRaw)
    ? (jobTypeRaw as Job)
    : "REPORT";

  const created = await createExecutiveSchedule({
    name: typeof body.name === "string" ? body.name : `${period} executive report`,
    period: period as "DAILY" | "WEEKLY" | "MONTHLY",
    format:
      typeof body.format === "string"
        ? (body.format as ExecutiveExportFormat)
        : "csv",
    recipients: Array.isArray(body.recipients)
      ? body.recipients.map(String)
      : [],
    timezone:
      typeof body.timezone === "string" ? body.timezone : "America/New_York",
    runHour: typeof body.runHour === "number" ? body.runHour : 6,
    jobType,
    createdById: actor.userId,
    createdByName: actor.displayName,
  });

  return NextResponse.json({ ok: true, item: created });
}
