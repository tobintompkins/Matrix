import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import {
  getOrCreateDefaultScoringProfile,
  getOrCreatePredictiveSettings,
} from "@/lib/predictive-maintenance/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_PREDICTIVE_MAINTENANCE");
  if (denied) return denied;

  const organizationId = DEFAULT_ORG_ID;
  await getOrCreatePredictiveSettings(organizationId);
  await getOrCreateDefaultScoringProfile(organizationId);

  // Latest snapshot per machine (simple approach for SQLite)
  const snapshots = await prisma.machineHealthSnapshot.findMany({
    where: { organizationId },
    orderBy: { generatedAt: "desc" },
    take: 500,
  });
  const latestByMachine = new Map<string, (typeof snapshots)[0]>();
  for (const s of snapshots) {
    if (!latestByMachine.has(s.machineId)) latestByMachine.set(s.machineId, s);
  }
  const latest = [...latestByMachine.values()];

  const openRecs = await prisma.predictiveMaintenanceRecommendation.count({
    where: { organizationId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
  });
  const openAlerts = await prisma.predictiveRiskAlert.count({
    where: { organizationId, status: "OPEN" },
  });
  const lastRun = await prisma.predictiveMaintenanceRun.findFirst({
    where: { organizationId },
    orderBy: { startedAt: "desc" },
  });

  const fleetHealth =
    latest.length === 0
      ? null
      : Math.round(
          latest.reduce((s, x) => s + x.healthScore, 0) / latest.length,
        );

  const byRisk = {
    LOW: latest.filter((s) => s.riskLevel === "LOW").length,
    MODERATE: latest.filter((s) => s.riskLevel === "MODERATE").length,
    HIGH: latest.filter((s) => s.riskLevel === "HIGH").length,
    CRITICAL: latest.filter((s) => s.riskLevel === "CRITICAL").length,
    UNKNOWN: latest.filter((s) => s.riskLevel === "UNKNOWN").length,
  };

  const dueSoon = latest.filter((s) => {
    if (!s.predictedMaintenanceDate) return false;
    const days =
      (s.predictedMaintenanceDate.getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 14;
  }).length;

  const lowData = latest.filter((s) => s.dataQualityScore < 40).length;

  const highestRisk = latest
    .filter((s) => s.riskLevel === "CRITICAL" || s.riskLevel === "HIGH")
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 8);

  const criticalAlerts = await prisma.predictiveRiskAlert.findMany({
    where: {
      organizationId,
      status: "OPEN",
      severity: { in: ["CRITICAL", "HIGH"] },
    },
    orderBy: { openedAt: "desc" },
    take: 8,
  });

  const pendingRecs = await prisma.predictiveMaintenanceRecommendation.findMany({
    where: { organizationId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return NextResponse.json({
    ok: true,
    advisory:
      "Scores and windows are predictions from explainable rules — not confirmed failures. Review source records before acting.",
    overview: {
      fleetHealthScore: fleetHealth,
      machinesEvaluated: latest.length,
      healthy: byRisk.LOW,
      watch: byRisk.MODERATE,
      highRisk: byRisk.HIGH,
      criticalRisk: byRisk.CRITICAL,
      unknown: byRisk.UNKNOWN,
      pmLikelyDueSoon: dueSoon,
      lowDataQuality: lowData,
      openRecommendations: openRecs,
      openAlerts,
      lastRun,
      riskDistribution: byRisk,
      highestRisk,
      criticalAlerts,
      pendingRecommendations: pendingRecs,
    },
  });
}
