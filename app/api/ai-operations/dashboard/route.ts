import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { getAiOperationsDashboard } from "@/lib/ai/dashboard";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { ensureAiCenterSeeded } from "@/lib/ai/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_OPERATIONS");
  if (denied) return denied;
  try {
    await ensureAiCenterSeeded();
    const dashboard = await getAiOperationsDashboard(DEFAULT_ORG_ID);
    return NextResponse.json({ ok: true, dashboard });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
