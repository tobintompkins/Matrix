import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  gatherMachinePredictiveInput,
  listPredictiveMachineIds,
} from "@/lib/predictive-maintenance/gather-input";
import { assessMachineDataReadiness } from "@/lib/predictive-maintenance/data-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_PREDICTIVE_MAINTENANCE");
  if (denied) return denied;

  const ids = await listPredictiveMachineIds(100);
  const rows = [];
  for (const id of ids) {
    const input = await gatherMachinePredictiveInput(id);
    if (!input) continue;
    const readiness = assessMachineDataReadiness(input);
    rows.push({
      machineId: id,
      printerModel: input.printerModel,
      customerName: input.customerName,
      ready: readiness.ready,
      score: readiness.score,
      missingFields: readiness.missingFields,
      warnings: readiness.warnings,
    });
  }

  const readyCount = rows.filter((r) => r.ready).length;
  return NextResponse.json({
    ok: true,
    summary: {
      total: rows.length,
      ready: readyCount,
      notReady: rows.length - readyCount,
    },
    items: rows.sort((a, b) => a.score - b.score),
    links: {
      dataQualityCenter: "/admin/data-quality",
      meterEntry: "/maintenance/counts",
      pmSettings: "/maintenance/settings",
    },
  });
}

export async function POST() {
  // history / runs listing reuse
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_PREDICTIVE_HISTORY");
  if (denied) return denied;
  const runs = await prisma.predictiveMaintenanceRun.findMany({
    where: { organizationId: DEFAULT_ORG_ID },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ ok: true, runs });
}
