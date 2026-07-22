import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  answerExecutiveInsight,
  listExecutiveInsightPresets,
} from "@/lib/executive-command-center/insights-qa";
import { checkExecutiveRateLimit } from "@/lib/executive-command-center/rate-limit";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "USE_EXECUTIVE_AI_INSIGHTS");
  if (denied) return denied;
  return NextResponse.json({
    ok: true,
    presets: listExecutiveInsightPresets(),
  });
}

export async function POST(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "USE_EXECUTIVE_AI_INSIGHTS");
  if (denied) return denied;

  const rl = checkExecutiveRateLimit(`insights:${actor.userId}`, 15);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded.", retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const question =
    typeof body.question === "string" ? body.question : "What needs attention today?";

  try {
    const answer = await answerExecutiveInsight({
      question,
      organizationId: DEFAULT_ORG_ID,
    });
    await writeAdminAudit({
      organizationId: DEFAULT_ORG_ID,
      actorId: actor.userId,
      action: "EXECUTIVE_AI_INSIGHT_REQUESTED",
      entityType: "ExecutiveCommandCenter",
      message: question.slice(0, 200),
      category: "AI_OPERATIONS",
      severity: "INFO",
      outcome: "SUCCESS",
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, ...answer });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Insight failed.",
      },
      { status: 500 },
    );
  }
}
