import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { gatherMachinePredictiveInput } from "@/lib/predictive-maintenance/gather-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_PREDICTIVE_MAINTENANCE");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const until = new Date(Date.now() + days * 86_400_000);

  const snapshots = await prisma.machineHealthSnapshot.findMany({
    where: { organizationId: DEFAULT_ORG_ID },
    orderBy: { generatedAt: "desc" },
    take: 500,
  });
  const latestByMachine = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!latestByMachine.has(s.machineId)) latestByMachine.set(s.machineId, s);
  }

  const items = [];
  for (const s of latestByMachine.values()) {
    if (!s.predictedMaintenanceDate) continue;
    if (s.predictedMaintenanceDate > until) continue;
    const input = await gatherMachinePredictiveInput(s.machineId);
    items.push({
      machineId: s.machineId,
      customerName: input?.customerName ?? null,
      siteName: input?.siteName ?? null,
      printerModel: input?.printerModel ?? null,
      riskLevel: s.riskLevel,
      confidenceScore: s.confidenceScore,
      officialDueMeter: input?.nextPmDueCount ?? null,
      predictedDate: s.predictedMaintenanceDate,
      windowStart: s.predictedMaintenanceWindowStart,
      windowEnd: s.predictedMaintenanceWindowEnd,
      assignedTechnician: input?.assignedTechnician ?? null,
      primaryRiskReason: s.primaryRiskReason,
    });
  }

  items.sort(
    (a, b) =>
      (a.predictedDate?.getTime() ?? 0) - (b.predictedDate?.getTime() ?? 0),
  );

  return NextResponse.json({
    ok: true,
    days,
    items,
    note: "Predicted ideal windows are advisory and do not reschedule official PM due dates.",
  });
}
