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
    const [metrics, cards] = await Promise.all([
      aiEngine.metrics(actor.userId),
      aiEngine.metricCards(actor.userId),
    ]);
    return NextResponse.json({
      ok: true,
      metrics,
      cards: {
        serviceCallsToday: cards.serviceCallsToday,
        pmDue: cards.pmDue,
        inventoryAlerts: cards.inventoryAlerts,
        averageResponseTimeMs: cards.averageResponseTimeMs,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
