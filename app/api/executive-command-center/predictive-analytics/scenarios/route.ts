import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { runScenarioPlanner } from "@/lib/executive-command-center/predictive-business/scenario-planner";

export const dynamic = "force-dynamic";

/**
 * Scenario planner — never mutates live records.
 */
export async function POST(req: NextRequest) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_EXECUTIVE_ANALYTICS");
  if (denied) {
    const deniedEcc = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
    if (deniedEcc) return deniedEcc;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      label?: string;
      serviceDemandDeltaPct?: number;
      pmWorkloadDeltaPct?: number;
      partsDemandDeltaPct?: number;
      technicianCapacityDeltaPct?: number;
    };
    const scenario = await runScenarioPlanner({
      label: body.label,
      assumptions: {
        serviceDemandDeltaPct: Number(body.serviceDemandDeltaPct) || 0,
        pmWorkloadDeltaPct: Number(body.pmWorkloadDeltaPct) || 0,
        partsDemandDeltaPct: Number(body.partsDemandDeltaPct) || 0,
        technicianCapacityDeltaPct:
          Number(body.technicianCapacityDeltaPct) || 0,
      },
    });
    return NextResponse.json({ ok: true, scenario });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Scenario failed.",
      },
      { status: 500 },
    );
  }
}
