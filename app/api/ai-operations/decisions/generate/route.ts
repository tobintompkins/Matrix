import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { runDecisionEngineBatch } from "@/lib/decision-engine";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "RUN_DECISION_ENGINE");
  if (denied) return denied;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const includeInventoryCosts = hasMatrixPermission(
    actor.role,
    "VIEW_DECISION_COSTS",
  );

  const result = await runDecisionEngineBatch({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    includeInventoryCosts,
    scopes: Array.isArray(body.scopes)
      ? (body.scopes as Array<
          "predictive" | "sla" | "repeat" | "inventory" | "pm" | "expire"
        >)
      : undefined,
  });

  return NextResponse.json({
    ok: true,
    ...result,
    message: `Generated ${result.created} new and refreshed ${result.refreshed} recommendations (${result.expired} expired).`,
  });
}
