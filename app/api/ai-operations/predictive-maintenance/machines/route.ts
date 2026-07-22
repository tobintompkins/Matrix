import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { gatherMachinePredictiveInput } from "@/lib/predictive-maintenance/gather-input";
import { listPredictiveMachineIds } from "@/lib/predictive-maintenance/gather-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_MACHINE_HEALTH");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const riskLevel = searchParams.get("riskLevel") ?? "";
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const sort = searchParams.get("sort") ?? "risk";

  const organizationId = DEFAULT_ORG_ID;
  const snapshots = await prisma.machineHealthSnapshot.findMany({
    where: { organizationId },
    orderBy: { generatedAt: "desc" },
    take: 800,
  });
  const latestByMachine = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!latestByMachine.has(s.machineId)) latestByMachine.set(s.machineId, s);
  }

  // Include machines without snapshots yet
  const allIds = await listPredictiveMachineIds(200);
  for (const id of allIds) {
    if (!latestByMachine.has(id)) {
      // placeholder empty — UI can show "Not evaluated"
    }
  }

  let rows = await Promise.all(
    [...latestByMachine.values()].map(async (s) => {
      const input = await gatherMachinePredictiveInput(s.machineId);
      return {
        machineId: s.machineId,
        printerModel: input?.printerModel ?? null,
        customerName: input?.customerName ?? null,
        siteName: input?.siteName ?? null,
        currentMeter: input?.currentMeterCount ?? null,
        healthScore: s.healthScore,
        riskLevel: s.riskLevel,
        confidenceScore: s.confidenceScore,
        dataQualityScore: s.dataQualityScore,
        predictedMaintenanceDate: s.predictedMaintenanceDate,
        primaryRiskReason: s.primaryRiskReason,
        assignedTechnician: input?.assignedTechnician ?? null,
        generatedAt: s.generatedAt,
        snapshotId: s.id,
      };
    }),
  );

  // Unevaluated machines
  for (const id of allIds) {
    if (latestByMachine.has(id)) continue;
    const input = await gatherMachinePredictiveInput(id);
    rows.push({
      machineId: id,
      printerModel: input?.printerModel ?? null,
      customerName: input?.customerName ?? null,
      siteName: input?.siteName ?? null,
      currentMeter: input?.currentMeterCount ?? null,
      healthScore: null as unknown as number,
      riskLevel: "UNKNOWN",
      confidenceScore: 0,
      dataQualityScore: 0,
      predictedMaintenanceDate: null,
      primaryRiskReason: "Not yet evaluated",
      assignedTechnician: input?.assignedTechnician ?? null,
      generatedAt: null as unknown as Date,
      snapshotId: "",
    });
  }

  if (riskLevel) rows = rows.filter((r) => r.riskLevel === riskLevel);
  if (q) {
    rows = rows.filter(
      (r) =>
        r.machineId.toLowerCase().includes(q) ||
        (r.customerName ?? "").toLowerCase().includes(q) ||
        (r.printerModel ?? "").toLowerCase().includes(q),
    );
  }

  const riskRank: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MODERATE: 2,
    UNKNOWN: 3,
    LOW: 4,
  };
  rows.sort((a, b) => {
    if (sort === "health") {
      return (a.healthScore ?? 999) - (b.healthScore ?? 999);
    }
    if (sort === "due") {
      const at = a.predictedMaintenanceDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bt = b.predictedMaintenanceDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return at - bt;
    }
    return (riskRank[a.riskLevel] ?? 9) - (riskRank[b.riskLevel] ?? 9);
  });

  return NextResponse.json({ ok: true, items: rows });
}
