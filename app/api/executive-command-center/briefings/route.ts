import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { buildExecutiveBriefingCenter } from "@/lib/executive-command-center/briefing-center";
import { parseExecutiveFilters } from "@/lib/executive-command-center/filters";
import { checkExecutiveRateLimit } from "@/lib/executive-command-center/rate-limit";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
  if (denied) return denied;

  const rl = checkExecutiveRateLimit(`briefing:${actor.userId}`, 30);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded.", retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const period = req.nextUrl.searchParams.get("period");
    const filters = parseExecutiveFilters(req.nextUrl.searchParams);
    const bundle = await buildExecutiveBriefingCenter({
      organizationId: DEFAULT_ORG_ID,
      period,
      filters,
    });
    await writeAdminAudit({
      organizationId: DEFAULT_ORG_ID,
      actorId: actor.userId,
      action: "EXECUTIVE_BRIEFING_VIEWED",
      entityType: "ExecutiveCommandCenter",
      message: `Briefing ${bundle.periodLabel}`,
      category: "AI_OPERATIONS",
      severity: "INFO",
      outcome: "SUCCESS",
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, ...bundle });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Briefing failed.",
      },
      { status: 500 },
    );
  }
}
