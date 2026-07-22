import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  deleteReportConfig,
  listReportConfigs,
  listReportHistory,
  saveReportConfig,
} from "@/lib/executive-command-center/report-configs";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { ExecutiveExportFormat } from "@/lib/executive-command-center/reporting-types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_REPORTS");
  if (denied) return denied;

  const kind = req.nextUrl.searchParams.get("kind") || "configs";
  if (kind === "history") {
    const items = await listReportHistory(DEFAULT_ORG_ID);
    return NextResponse.json({
      ok: true,
      items: items.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  }
  const items = await listReportConfigs(DEFAULT_ORG_ID);
  return NextResponse.json({
    ok: true,
    items: items.map((c) => ({
      ...c,
      filters: JSON.parse(c.filtersJson || "{}"),
      sections: JSON.parse(c.sectionsJson || "[]"),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_REPORTS");
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (body.action === "delete" && typeof body.id === "string") {
    const ok = await deleteReportConfig(body.id, DEFAULT_ORG_ID);
    return NextResponse.json({ ok });
  }

  const created = await saveReportConfig({
    name: typeof body.name === "string" ? body.name : "Saved report",
    period: typeof body.period === "string" ? body.period : "WEEKLY",
    format:
      typeof body.format === "string"
        ? (body.format as ExecutiveExportFormat)
        : "csv",
    filters:
      body.filters && typeof body.filters === "object"
        ? (body.filters as Record<string, unknown>)
        : {},
    sections: Array.isArray(body.sections) ? body.sections.map(String) : [],
    createdById: actor.userId,
    createdByName: actor.displayName,
  });

  await writeAdminAudit({
    organizationId: DEFAULT_ORG_ID,
    actorId: actor.userId,
    action: "EXECUTIVE_REPORT_CONFIG_SAVED",
    entityType: "ExecutiveReportConfig",
    entityId: created.id,
    message: created.name,
    category: "AI_OPERATIONS",
    severity: "INFO",
    outcome: "SUCCESS",
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, item: created });
}
