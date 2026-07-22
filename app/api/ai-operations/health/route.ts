import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getAiOperationsHealth } from "@/lib/ai/dashboard";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_HEALTH");
  if (denied) return denied;
  const health = await getAiOperationsHealth(DEFAULT_ORG_ID);
  return NextResponse.json({ ok: true, health });
}
