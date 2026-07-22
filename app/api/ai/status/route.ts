import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor, ensureAiCenterSeeded } from "@/lib/ai";
import { aiEngine } from "@/services/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_AI_CENTER");
  if (denied) return denied;
  try {
    await ensureAiCenterSeeded();
    const status = await aiEngine.status(actor.userId);
    return NextResponse.json({
      ok: true,
      online: status.online,
      version: status.version,
      uptime: status.uptime,
      learningEnabled: status.learningEnabled,
      confidence: status.confidence,
      responseTime: status.responseTime,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
