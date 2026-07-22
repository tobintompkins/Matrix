import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { gatherMachinePredictiveInput } from "@/lib/predictive-maintenance/gather-input";
import { assessMachineDataReadiness } from "@/lib/predictive-maintenance/data-readiness";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ machineId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_MACHINE_HEALTH");
  if (denied) return denied;

  const { machineId } = await params;
  const organizationId = DEFAULT_ORG_ID;
  const input = await gatherMachinePredictiveInput(machineId);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Machine not found." }, { status: 404 });
  }

  const latest = await prisma.machineHealthSnapshot.findFirst({
    where: { organizationId, machineId },
    orderBy: { generatedAt: "desc" },
  });
  const history = await prisma.machineHealthSnapshot.findMany({
    where: { organizationId, machineId },
    orderBy: { generatedAt: "desc" },
    take: 30,
  });
  const recommendations = await prisma.predictiveMaintenanceRecommendation.findMany({
    where: { organizationId, machineId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const alerts = await prisma.predictiveRiskAlert.findMany({
    where: { organizationId, machineId },
    orderBy: { openedAt: "desc" },
    take: 40,
  });

  const readiness = assessMachineDataReadiness(input);

  return NextResponse.json({
    ok: true,
    machine: input,
    readiness,
    latest,
    history,
    recommendations,
    alerts,
    advisory:
      "Predicted values are advisory. Official PM due rules remain authoritative for compliance.",
  });
}
