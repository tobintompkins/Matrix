import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { predictiveRowsToCsv } from "@/lib/predictive-maintenance/export";
import { writePredictiveAudit } from "@/lib/predictive-maintenance/settings";

export const dynamic = "force-dynamic";

/**
 * Export predictive snapshots / alerts / recommendations.
 * Query: ?dataset=snapshots|alerts|recommendations|runs&format=csv|json&days=90
 */
export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "EXPORT_PREDICTIVE_DATA");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const dataset = searchParams.get("dataset") ?? "snapshots";
  const format = searchParams.get("format") ?? "csv";
  const days = Math.min(365, Math.max(1, Number(searchParams.get("days") ?? "90")));
  const since = new Date(Date.now() - days * 86_400_000);
  const organizationId = DEFAULT_ORG_ID;

  let headers: string[] = [];
  let rows: Array<Record<string, unknown>> = [];

  if (dataset === "alerts") {
    const items = await prisma.predictiveRiskAlert.findMany({
      where: { organizationId, openedAt: { gte: since } },
      orderBy: { openedAt: "desc" },
      take: 2000,
    });
    headers = [
      "id",
      "machineId",
      "alertType",
      "severity",
      "status",
      "title",
      "openedAt",
    ];
    rows = items.map((a) => ({
      id: a.id,
      machineId: a.machineId,
      alertType: a.alertType,
      severity: a.severity,
      status: a.status,
      title: a.title,
      openedAt: a.openedAt.toISOString(),
    }));
  } else if (dataset === "recommendations") {
    const items = await prisma.predictiveMaintenanceRecommendation.findMany({
      where: { organizationId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    headers = [
      "id",
      "machineId",
      "recommendationType",
      "priority",
      "status",
      "title",
      "createdAt",
    ];
    rows = items.map((r) => ({
      id: r.id,
      machineId: r.machineId,
      recommendationType: r.recommendationType,
      priority: r.priority,
      status: r.status,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
    }));
  } else if (dataset === "runs") {
    const items = await prisma.predictiveMaintenanceRun.findMany({
      where: { organizationId, startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      take: 500,
    });
    headers = [
      "id",
      "runType",
      "status",
      "machinesEvaluated",
      "recommendationsCreated",
      "alertsCreated",
      "scoringVersion",
      "startedAt",
    ];
    rows = items.map((r) => ({
      id: r.id,
      runType: r.runType,
      status: r.status,
      machinesEvaluated: r.machinesEvaluated,
      recommendationsCreated: r.recommendationsCreated,
      alertsCreated: r.alertsCreated,
      scoringVersion: r.scoringVersion,
      startedAt: r.startedAt.toISOString(),
    }));
  } else {
    const items = await prisma.machineHealthSnapshot.findMany({
      where: { organizationId, generatedAt: { gte: since } },
      orderBy: { generatedAt: "desc" },
      take: 2000,
    });
    headers = [
      "id",
      "machineId",
      "healthScore",
      "riskLevel",
      "dataQualityScore",
      "confidenceScore",
      "predictedMaintenanceDate",
      "primaryRiskReason",
      "scoringVersion",
      "generatedAt",
    ];
    rows = items.map((s) => ({
      id: s.id,
      machineId: s.machineId,
      healthScore: s.healthScore,
      riskLevel: s.riskLevel,
      dataQualityScore: s.dataQualityScore,
      confidenceScore: s.confidenceScore,
      predictedMaintenanceDate: s.predictedMaintenanceDate?.toISOString() ?? "",
      primaryRiskReason: s.primaryRiskReason,
      scoringVersion: s.scoringVersion,
      generatedAt: s.generatedAt.toISOString(),
    }));
  }

  await writePredictiveAudit({
    action: "predictive.export",
    entityType: "PredictiveExport",
    actorUserId: actor.userId,
    payload: { dataset, format, days, rowCount: rows.length },
  });

  if (format === "json") {
    return NextResponse.json({ ok: true, dataset, days, rows });
  }

  const csv = predictiveRowsToCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="predictive-${dataset}-${days}d.csv"`,
    },
  });
}
