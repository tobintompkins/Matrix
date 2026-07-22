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
    const summary = await aiEngine.summary(actor.userId);
    return NextResponse.json({
      ok: true,
      title: summary.title,
      serviceCalls: summary.serviceCalls,
      completedPms: summary.completedPms,
      inventoryAlerts: summary.inventoryAlerts,
      averageTechnicianUtilization: summary.averageTechnicianUtilization,
      openIncidents: summary.openIncidents,
      generatedAt: summary.generatedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
