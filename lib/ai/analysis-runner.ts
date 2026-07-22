/**
 * Patch 51A.1 Part 2 — Analysis runner.
 * Derives advisory insights from existing Matrix operational data.
 * Never modifies operational records.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import { aiConfig } from "@/config/ai";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { digitalTwinFleet } from "@/lib/digital-twin";
import { listServiceCalls } from "@/lib/service-calls";
import type {
  AiInsightSeverity,
  AiInsightType,
  AiOpsAnalysisRunDto,
  AiRiskCategory,
  AiSourceModule,
} from "./insight-types";
import { notifyAiOperationsEvent } from "./notifications";

type CandidateInsight = {
  insightType: AiInsightType;
  sourceModule: AiSourceModule;
  title: string;
  summary: string;
  explanation: string;
  recommendedAction: string;
  severity: AiInsightSeverity;
  confidence: number;
  riskCategory: AiRiskCategory;
  supportingEvidence: Record<string, unknown>;
  limitations: string;
  customerName?: string | null;
  siteName?: string | null;
  machineId?: string | null;
  machineLabel?: string | null;
  serviceCallId?: string | null;
  inventoryItemId?: string | null;
  relatedRecordHref?: string | null;
};

let runningLock = false;

function mapRun(row: {
  id: string;
  organizationId: string;
  status: string;
  requestedByUserId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  recordsAnalyzed: number;
  recordsSkipped: number;
  insightsCreated: number;
  errorSummary: string | null;
  analysisVersion: string;
  rulesVersion: string;
  cancelRequested: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AiOpsAnalysisRunDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    status: row.status as AiOpsAnalysisRunDto["status"],
    requestedByUserId: row.requestedByUserId,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    recordsAnalyzed: row.recordsAnalyzed,
    recordsSkipped: row.recordsSkipped,
    insightsCreated: row.insightsCreated,
    errorSummary: row.errorSummary,
    analysisVersion: row.analysisVersion,
    rulesVersion: row.rulesVersion,
    cancelRequested: row.cancelRequested,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function collectCandidates(): Promise<{
  candidates: CandidateInsight[];
  analyzed: number;
  skipped: number;
  excluded: string[];
}> {
  const candidates: CandidateInsight[] = [];
  let analyzed = 0;
  let skipped = 0;
  const excluded: string[] = [];

  const calls = listServiceCalls({ includeDeleted: false });
  analyzed += calls.length;
  const byMachine = new Map<string, typeof calls>();
  for (const call of calls) {
    const key = call.machine.machineId || call.machine.serialNumber || "unknown";
    const list = byMachine.get(key) ?? [];
    list.push(call);
    byMachine.set(key, list);
  }

  for (const [machineKey, machineCalls] of byMachine) {
    if (machineCalls.length >= 3) {
      const sample = machineCalls[0]!;
      candidates.push({
        insightType: "REPEAT_FAILURE",
        sourceModule: "SERVICE",
        title: `Repeat service activity on ${sample.machine.nickname || machineKey}`,
        summary: `${machineCalls.length} service calls are associated with this machine in the current operational set.`,
        explanation:
          "Repeated service activity may indicate unresolved root cause, parts quality issues, or documentation gaps.",
        recommendedAction:
          "Review recent closed calls, verify parts replaced, and confirm PM / meter status before the next dispatch.",
        severity: machineCalls.length >= 5 ? "CRITICAL" : "HIGH",
        confidence: Math.min(97, 80 + machineCalls.length * 2),
        riskCategory: machineCalls.length >= 5 ? "ACT_NOW" : "PLAN_NEXT",
        supportingEvidence: {
          callCount: machineCalls.length,
          workOrders: machineCalls.slice(0, 5).map((c) => c.workOrderNumber),
        },
        limitations:
          "Counts reflect currently loaded Matrix service-call data; historical archives outside this set are not included.",
        customerName: sample.machine.customerName,
        siteName: sample.machine.siteName,
        machineId: sample.machine.machineId,
        machineLabel: sample.machine.nickname || sample.machine.serialNumber,
        serviceCallId: sample.id,
        relatedRecordHref: `/service-calls/${sample.id}`,
      });
    }
  }

  const openLong = calls.filter(
    (c) =>
      c.status !== "CLOSED" &&
      c.status !== "CANCELLED" &&
      c.status !== "RESOLVED",
  );
  if (openLong.length >= 8) {
    candidates.push({
      insightType: "SERVICE_RISK",
      sourceModule: "SERVICE",
      title: "Elevated open service-call backlog",
      summary: `${openLong.length} service calls remain open in the current operational set.`,
      explanation:
        "A high open-call count may signal dispatch capacity pressure or stalled work awaiting parts.",
      recommendedAction:
        "Triage open calls by age and priority; escalate stalled WAITING_FOR_PARTS items.",
      severity: openLong.length >= 15 ? "HIGH" : "MEDIUM",
      confidence: 88,
      riskCategory: "PLAN_NEXT",
      supportingEvidence: { openCount: openLong.length },
      limitations: "Does not include soft-deleted or archived calls.",
      relatedRecordHref: "/service-calls",
    });
  }

  analyzed += digitalTwinFleet.length;
  const retiredOrDown = digitalTwinFleet.filter(
    (m) =>
      m.operational.status === "DOWN" ||
      m.operational.status === "SERVICE_REQUIRED",
  );
  for (const m of retiredOrDown.slice(0, 8)) {
    candidates.push({
      insightType: "DOWNTIME_RISK",
      sourceModule: "FLEET",
      title: `Machine health attention: ${m.identity.nickname}`,
      summary: `${m.identity.nickname} reports status ${m.operational.status}.`,
      explanation:
        "Fleet health signals from the digital twin indicate elevated customer-impact risk.",
      recommendedAction:
        "Confirm on-site status, open or update a service call if required, and notify the account owner.",
      severity: m.operational.status === "DOWN" ? "CRITICAL" : "HIGH",
      confidence: 90,
      riskCategory: m.operational.status === "DOWN" ? "ACT_NOW" : "PLAN_NEXT",
      supportingEvidence: {
        status: m.operational.status,
        serial: m.identity.serialNumber,
        model: m.identity.printerModel,
      },
      limitations:
        "Digital twin status may lag field reality until the next sync or technician update.",
      customerName: m.location.customerName,
      siteName: m.location.siteName,
      machineId: m.identity.machineId,
      machineLabel: m.identity.nickname,
      relatedRecordHref: `/digital-twin?machine=${encodeURIComponent(m.identity.machineId)}`,
    });
  }

  let inventoryCount = 0;
  try {
    const inv = await import("@/lib/inventory/enterprise-repository");
    const listed = inv.listCatalog(undefined, 1, 500).items;
    analyzed += listed.length;
    inventoryCount = listed.length;
    const inactive = listed.filter(
      (p) => String((p as { status?: string }).status ?? "").toUpperCase() === "INACTIVE",
    );
    if (inactive.length > 0) {
      candidates.push({
        insightType: "INVENTORY_RISK",
        sourceModule: "INVENTORY",
        title: "Inactive catalog parts present",
        summary: `${inactive.length} catalog parts are marked inactive and may need review for mappings or substitutes.`,
        explanation:
          "Inactive parts can break reorder mappings and confuse emergency ordering.",
        recommendedAction:
          "Review inactive parts for substitute mappings and technician visibility.",
        severity: "MEDIUM",
        confidence: 86,
        riskCategory: "MONITOR",
        supportingEvidence: {
          sample: inactive.slice(0, 5).map((p) => p.partNumber),
        },
        limitations:
          "Stock quantity thresholds are not fully evaluated in this analysis version.",
        inventoryItemId: inactive[0]?.id,
        relatedRecordHref: "/inventory",
      });
    }
  } catch {
    skipped += 1;
    excluded.push("Inventory catalog unavailable for this analysis pass");
  }
  void inventoryCount;


  // PM signal from twin meters when available
  const highMeter = digitalTwinFleet.filter((m) => {
    const meters = (m as { meters?: { total?: number } }).meters;
    return typeof meters?.total === "number" && meters.total > 500000;
  });
  if (highMeter.length > 0) {
    const m = highMeter[0]!;
    candidates.push({
      insightType: "PM_DUE_RISK",
      sourceModule: "PM",
      title: "High meter volume machines may need PM verification",
      summary: `${highMeter.length} machine(s) report elevated total meter volume in digital twin data.`,
      explanation:
        "High cumulative meters increase the likelihood of approaching PM windows; verify against the PM schedule.",
      recommendedAction:
        "Open Fleet Maintenance / PM views and verify due status for high-meter equipment.",
      severity: "MEDIUM",
      confidence: 84,
      riskCategory: "PLAN_NEXT",
      supportingEvidence: {
        count: highMeter.length,
        sampleSerial: m.identity.serialNumber,
      },
      limitations:
        "Meter thresholds are heuristic for this analysis version and should be confirmed in the PM module.",
      machineId: m.identity.machineId,
      machineLabel: m.identity.nickname,
      relatedRecordHref: "/maintenance",
    });
  } else {
    excluded.push("Insufficient PM meter detail for overdue predictions");
  }

  if (candidates.length === 0) {
    candidates.push({
      insightType: "GENERAL_RECOMMENDATION",
      sourceModule: "GENERAL",
      title: "Insufficient operational signal for high-confidence insights",
      summary:
        "Matrix does not currently present enough concentrated operational risk patterns for critical AI insights.",
      explanation:
        "The analysis scanned available service, fleet, and inventory data but did not find strong repeat-failure or downtime clusters.",
      recommendedAction:
        "Continue normal operations. Re-run analysis after additional service or PM activity is recorded.",
      severity: "INFO",
      confidence: 70,
      riskCategory: "LOW_PRIORITY",
      supportingEvidence: {
        serviceCallsScanned: calls.length,
        machinesScanned: digitalTwinFleet.length,
      },
      limitations: "Absence of findings is not a guarantee of operational health.",
    });
  }

  return { candidates, analyzed, skipped, excluded };
}

export async function getActiveAnalysisRun(
  organizationId = DEFAULT_ORG_ID,
): Promise<AiOpsAnalysisRunDto | null> {
  const row = await prisma.aiOpsAnalysisRun.findFirst({
    where: {
      organizationId,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });
  return row ? mapRun(row) : null;
}

export async function listAnalysisRuns(input: {
  organizationId: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AiOpsAnalysisRunDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const where = { organizationId: input.organizationId };
  const [total, rows] = await Promise.all([
    prisma.aiOpsAnalysisRun.count({ where }),
    prisma.aiOpsAnalysisRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items: rows.map(mapRun), total, page, pageSize };
}

export async function getAnalysisRun(
  id: string,
  organizationId: string,
): Promise<AiOpsAnalysisRunDto | null> {
  const row = await prisma.aiOpsAnalysisRun.findFirst({
    where: { id, organizationId },
  });
  return row ? mapRun(row) : null;
}

export async function requestCancelAnalysisRun(
  id: string,
  organizationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await prisma.aiOpsAnalysisRun.findFirst({
    where: { id, organizationId },
  });
  if (!row) return { ok: false, error: "Analysis run not found." };
  if (row.status !== "QUEUED") {
    return {
      ok: false,
      error: "Only queued analysis runs can be cancelled safely.",
    };
  }
  await prisma.aiOpsAnalysisRun.update({
    where: { id },
    data: { status: "CANCELLED", cancelRequested: true, completedAt: new Date() },
  });
  return { ok: true };
}

export async function runAiAnalysis(input: {
  organizationId?: string;
  requestedByUserId: string;
  requestedByName: string;
}): Promise<
  | { ok: true; run: AiOpsAnalysisRunDto }
  | { ok: false; error: string }
> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  if (runningLock) {
    return { ok: false, error: "An AI analysis is already running." };
  }
  const active = await getActiveAnalysisRun(organizationId);
  if (active) {
    return {
      ok: false,
      error: "An analysis is already queued or running. Wait for it to finish.",
    };
  }

  runningLock = true;
  const run = await prisma.aiOpsAnalysisRun.create({
    data: {
      organizationId,
      status: "QUEUED",
      requestedByUserId: input.requestedByUserId,
      analysisVersion: aiConfig.analysisVersion,
      rulesVersion: aiConfig.rulesVersion,
    },
  });

  await writeAdminAudit({
    organizationId,
    actorId: input.requestedByUserId,
    action: "AI_ANALYSIS_STARTED",
    entityType: "AiOpsAnalysisRun",
    entityId: run.id,
    payload: { requestedBy: input.requestedByName },
    category: "SYSTEM",
    severity: "INFO",
    outcome: "SUCCESS",
  });

  try {
    const startedAt = new Date();
    await prisma.aiOpsAnalysisRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", startedAt },
    });

    const { candidates, analyzed, skipped } = await collectCandidates();
    let created = 0;
    for (const c of candidates) {
      const insight = await prisma.aiOpsInsight.create({
        data: {
          organizationId,
          analysisRunId: run.id,
          insightType: c.insightType,
          sourceModule: c.sourceModule,
          title: c.title,
          summary: c.summary,
          explanation: c.explanation,
          recommendedAction: c.recommendedAction,
          severity: c.severity,
          confidence: Math.max(0, Math.min(100, c.confidence)),
          status: "NEW",
          riskCategory: c.riskCategory,
          supportingEvidence: JSON.stringify(c.supportingEvidence),
          limitations: c.limitations,
          analysisVersion: aiConfig.analysisVersion,
          customerName: c.customerName ?? null,
          siteName: c.siteName ?? null,
          machineId: c.machineId ?? null,
          machineLabel: c.machineLabel ?? null,
          serviceCallId: c.serviceCallId ?? null,
          inventoryItemId: c.inventoryItemId ?? null,
          relatedRecordHref: c.relatedRecordHref ?? null,
        },
      });
      await prisma.aiOpsInsightEvent.create({
        data: {
          insightId: insight.id,
          actorUserId: "system",
          actorName: "AI Analysis Engine",
          action: "INSIGHT_CREATED",
          newStatus: "NEW",
          note: "Created by analysis run",
        },
      });
      if (c.severity === "CRITICAL") {
        notifyAiOperationsEvent({
          type: "AI_CRITICAL_INSIGHT",
          title: "Critical AI insight",
          message: c.title,
          insightId: insight.id,
          priority: "URGENT",
        });
      }
      created += 1;
    }

    const completedAt = new Date();
    const updated = await prisma.aiOpsAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        recordsAnalyzed: analyzed,
        recordsSkipped: skipped,
        insightsCreated: created,
      },
    });

    await writeAdminAudit({
      organizationId,
      actorId: input.requestedByUserId,
      action: "AI_ANALYSIS_COMPLETED",
      entityType: "AiOpsAnalysisRun",
      entityId: run.id,
      payload: { insightsCreated: created, recordsAnalyzed: analyzed },
      category: "SYSTEM",
      severity: "INFO",
      outcome: "SUCCESS",
    });

    return { ok: true, run: mapRun(updated) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed.";
    const failed = await prisma.aiOpsAnalysisRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorSummary: message,
      },
    });
    await writeAdminAudit({
      organizationId,
      actorId: input.requestedByUserId,
      action: "AI_ANALYSIS_FAILED",
      entityType: "AiOpsAnalysisRun",
      entityId: run.id,
      payload: { error: message },
      category: "ERROR",
      severity: "ERROR",
      outcome: "FAILURE",
    });
    notifyAiOperationsEvent({
      type: "AI_ANALYSIS_FAILED",
      title: "AI analysis failed",
      message: message.slice(0, 240),
      insightId: run.id,
      userIds: [input.requestedByUserId],
      priority: "HIGH",
    });
    return { ok: true, run: mapRun(failed) };
  } finally {
    runningLock = false;
  }
}

export { collectCandidates };
