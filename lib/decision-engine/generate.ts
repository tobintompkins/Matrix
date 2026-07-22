/**
 * Patch 51A.4 — Generate decision drafts from existing Matrix signals.
 */

import { listServiceCalls } from "@/lib/service-calls";
import {
  isLowStock,
  listBalances,
  quantityAvailable,
} from "@/lib/inventory";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { gatherMachinePredictiveInput } from "@/lib/predictive-maintenance/gather-input";
import {
  buildScores,
  priorityFromOverall,
  scoresFromPredictiveRisk,
} from "./scoring";
import { buildFingerprint, upsertDecisionRecommendation } from "./persist";
import {
  HIGH_IMPACT_DECISION_TYPES,
  type DecisionEvidenceFact,
  type DecisionEvidenceSnapshot,
  type DraftDecision,
} from "./types";
import {
  getOrCreateDecisionSettings,
  weightsFromSettings,
} from "./settings";
import { expireStaleDecisions } from "./persist";

function fact(
  label: string,
  value: string | number | boolean | null | undefined,
  source?: string,
): DecisionEvidenceFact {
  if (value === null || value === undefined || value === "") {
    return { label, value: null, available: false, source };
  }
  return { label, value, available: true, source };
}

function evidenceOf(
  facts: DecisionEvidenceFact[],
  ruleMatches: string[],
  links: DecisionEvidenceSnapshot["links"],
): DecisionEvidenceSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    facts,
    ruleMatches,
    links,
  };
}

function markHighImpact(type: DraftDecision["decisionType"]): boolean {
  return HIGH_IMPACT_DECISION_TYPES.includes(type);
}

export async function draftFromPredictiveSnapshot(input: {
  machineId: string;
  healthSnapshotId?: string | null;
  riskLevel: string;
  healthScore: number;
  confidenceScore: number;
  dataQualityScore: number;
  primaryRiskReason?: string | null;
  organizationId?: string;
}): Promise<DraftDecision | null> {
  if (input.riskLevel !== "HIGH" && input.riskLevel !== "CRITICAL") {
    return null;
  }
  const machine = await gatherMachinePredictiveInput(input.machineId);
  const openCalls =
    machine?.serviceCalls.filter(
      (c) => !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status),
    ) ?? [];
  const machineDown = openCalls.some((c) => c.isEmergency);
  const pmOverdue =
    machine?.nextPmDueCount != null &&
    machine.currentMeterCount != null &&
    machine.currentMeterCount >= machine.nextPmDueCount;

  const scores = scoresFromPredictiveRisk({
    riskLevel: input.riskLevel,
    healthScore: input.healthScore,
    confidenceScore: input.confidenceScore,
    dataQualityScore: input.dataQualityScore,
    pmOverdue,
    machineDown,
  });

  const decisionType = "PREDICTIVE_MAINTENANCE" as const;
  const sourceId = input.healthSnapshotId ?? input.machineId;
  const fingerprint = buildFingerprint(
    decisionType,
    "MachineHealthSnapshot",
    sourceId,
    input.machineId,
  );

  return {
    decisionType,
    title: `${input.riskLevel} predictive risk — ${input.machineId}`,
    summary:
      input.primaryRiskReason ??
      `Machine ${input.machineId} scored ${input.riskLevel} predictive risk (health ${input.healthScore}).`,
    detailedReasoning: `Deterministic predictive scoring produced risk ${input.riskLevel} with confidence ${input.confidenceScore}%. Review linked PM and service records before scheduling work.`,
    sourceType: "MachineHealthSnapshot",
    sourceId,
    fingerprint,
    machineId: input.machineId,
    customerId: machine?.customerName ?? null,
    siteId: machine?.siteName ?? null,
    technicianId: machine?.assignedTechnician ?? null,
    priority: priorityFromOverall(scores.overallDecisionScore),
    scores,
    estimatedDowntimeMinutes: machineDown ? 240 : input.riskLevel === "CRITICAL" ? 180 : 90,
    estimatedLaborMinutes: 90,
    estimatedCostAvoidance: input.riskLevel === "CRITICAL" ? 2500 : 1200,
    slaImpact: machineDown ? "Production impact likely" : null,
    recommendedAction:
      "Schedule inspection or PM within 48 hours and review parts availability before dispatch.",
    alternativeActions: [
      {
        action: "Convert predictive alert into a draft service call",
        reason: "Use existing service-call workflow after manager approval.",
      },
      {
        action: "Defer with a reason and follow-up date",
        reason: "When a planned downtime window is already booked.",
      },
    ],
    evidence: evidenceOf(
      [
        fact("Machine ID", input.machineId, "predictive"),
        fact("Printer model", machine?.printerModel, "pm/digital-twin"),
        fact("Asset tag", machine?.assetTag, "pm/digital-twin"),
        fact("Customer", machine?.customerName, "pm/digital-twin"),
        fact("Site", machine?.siteName, "pm/digital-twin"),
        fact("Current meter", machine?.currentMeterCount, "pm"),
        fact("Next PM due meter", machine?.nextPmDueCount, "pm"),
        fact("PM overdue by meter", pmOverdue, "pm"),
        fact("Health score", input.healthScore, "predictive"),
        fact("Risk level", input.riskLevel, "predictive"),
        fact("Confidence score", input.confidenceScore, "predictive"),
        fact("Data quality score", input.dataQualityScore, "predictive"),
        fact("Open service calls", openCalls.length, "service-calls"),
        fact("Machine currently down signal", machineDown, "service-calls"),
        fact("Assigned technician", machine?.assignedTechnician, "pm"),
      ],
      ["PREDICTIVE_HIGH_OR_CRITICAL", ...(pmOverdue ? ["PM_OVERDUE"] : [])],
      [
        {
          label: "Predictive machine",
          href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(input.machineId)}`,
        },
        {
          label: "Fleet PM",
          href: `/maintenance`,
        },
      ],
    ),
    highImpact: false,
    dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  };
}

export async function draftSlaRiskFromServiceCalls(): Promise<DraftDecision[]> {
  const open = listServiceCalls({ includeDeleted: false }).filter(
    (c) =>
      !["CLOSED", "CANCELLED", "RESOLVED"].includes(c.status) &&
      (c.priority === "CRITICAL" ||
        c.priority === "EMERGENCY" ||
        c.priority === "URGENT" ||
        c.problem.machineCurrentlyDown),
  );

  return open.slice(0, 40).map((c) => {
    const hoursOpen =
      (Date.now() - new Date(c.createdAt).getTime()) / 3_600_000;
    const scores = buildScores({
      riskScore: c.problem.machineCurrentlyDown ? 90 : 70,
      urgencyScore: Math.min(100, 40 + hoursOpen * 2),
      businessImpactScore: c.priority === "EMERGENCY" ? 90 : 65,
      confidenceScore: 85,
      slaImpactScore: hoursOpen > 24 ? 90 : hoursOpen > 8 ? 70 : 45,
    });
    const decisionType = "SLA_RISK" as const;
    const fingerprint = buildFingerprint(
      decisionType,
      "ServiceCall",
      c.id,
      c.machine.machineId,
    );
    return {
      decisionType,
      title: `SLA risk — ${c.ticketNumber || c.id}`,
      summary: `Open ${c.priority} service call for ${c.machine.machineId} has been open ~${Math.round(hoursOpen)}h.`,
      detailedReasoning:
        "Priority and open duration indicate SLA exposure. Escalate or reassign using existing dispatch workflows after review.",
      sourceType: "ServiceCall",
      sourceId: c.id,
      fingerprint,
      machineId: c.machine.machineId,
      customerId: c.machine.customerName,
      siteId: c.machine.siteName,
      serviceCallId: c.id,
      technicianId: c.assignment.technician || null,
      priority: priorityFromOverall(scores.overallDecisionScore),
      scores,
      estimatedDowntimeMinutes: c.problem.machineCurrentlyDown ? 180 : 60,
      slaImpact: hoursOpen > 24 ? "Likely SLA breach" : "Approaching SLA risk",
      recommendedAction:
        "Review assignment and escalate if no technician is actively progressing the call.",
      alternativeActions: [
        {
          action: "Rebalance technician workload",
          reason: "When current assignee is overloaded.",
        },
      ],
      evidence: evidenceOf(
        [
          fact("Ticket", c.ticketNumber || c.id, "service-calls"),
          fact("Priority", c.priority, "service-calls"),
          fact("Status", c.status, "service-calls"),
          fact("Hours open", Math.round(hoursOpen), "service-calls"),
          fact("Machine", c.machine.machineId, "service-calls"),
          fact("Machine down", c.problem.machineCurrentlyDown, "service-calls"),
          fact(
            "Assigned technician",
            c.assignment.technician || null,
            "service-calls",
          ),
        ],
        ["OPEN_HIGH_PRIORITY_CALL"],
        [
          {
            label: "Service call",
            href: `/service-calls/${encodeURIComponent(c.id)}`,
          },
        ],
      ),
      highImpact: false,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    } satisfies DraftDecision;
  });
}

export async function draftRepeatFailureDecisions(): Promise<DraftDecision[]> {
  const closedish = listServiceCalls({ includeDeleted: false });
  const byMachine = new Map<string, typeof closedish>();
  for (const c of closedish) {
    const id = c.machine.machineId;
    const list = byMachine.get(id) ?? [];
    list.push(c);
    byMachine.set(id, list);
  }

  const drafts: DraftDecision[] = [];
  for (const [machineId, calls] of byMachine) {
    const recent = calls.filter(
      (c) =>
        Date.now() - new Date(c.createdAt).getTime() < 90 * 86_400_000,
    );
    if (recent.length < 3) continue;
    const scores = buildScores({
      riskScore: Math.min(95, 50 + recent.length * 10),
      urgencyScore: 55,
      businessImpactScore: 60,
      confidenceScore: 70,
      slaImpactScore: 35,
    });
    const decisionType = "REPEAT_FAILURE" as const;
    const fingerprint = buildFingerprint(
      decisionType,
      "Machine",
      machineId,
      machineId,
    );
    drafts.push({
      decisionType,
      title: `Repeat service pattern — ${machineId}`,
      summary: `${recent.length} service calls in the last 90 days for ${machineId}.`,
      detailedReasoning:
        "Repeated visits suggest an unresolved root cause. Consider deeper diagnosis or replacement review.",
      sourceType: "Machine",
      sourceId: machineId,
      fingerprint,
      machineId,
      customerId: recent[0]?.machine.customerName ?? null,
      siteId: recent[0]?.machine.siteName ?? null,
      priority: priorityFromOverall(scores.overallDecisionScore),
      scores,
      estimatedCostAvoidance: 800,
      recommendedAction:
        "Open a root-cause review and check recent parts replacements before the next visit.",
      alternativeActions: [
        {
          action: "Queue machine replacement review",
          reason: "When repair cost trend exceeds replacement threshold (manager approval).",
        },
      ],
      evidence: evidenceOf(
        [
          fact("Machine", machineId, "service-calls"),
          fact("Calls (90 days)", recent.length, "service-calls"),
          fact(
            "Latest issue",
            recent.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )[0]?.problem.issueTitle,
            "service-calls",
          ),
        ],
        ["REPEAT_CALLS_90D"],
        [
          {
            label: "Predictive machine view",
            href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(machineId)}`,
          },
        ],
      ),
      highImpact: false,
    });
  }
  return drafts.slice(0, 25);
}

export async function draftInventoryDecisions(includeCosts: boolean): Promise<
  DraftDecision[]
> {
  const balances = listBalances().filter(isLowStock).slice(0, 30);
  return balances.map((b) => {
    const available = quantityAvailable(b);
    const scores = buildScores({
      riskScore: available <= 0 ? 85 : 60,
      urgencyScore: available <= 0 ? 80 : 55,
      businessImpactScore: 50,
      confidenceScore: 90,
      slaImpactScore: available <= 0 ? 60 : 30,
    });
    const decisionType =
      available <= 0 ? ("PARTS_SHORTAGE" as const) : ("REORDER_RECOMMENDATION" as const);
    const fingerprint = buildFingerprint(
      decisionType,
      "StockBalance",
      `${b.partId}:${b.locationId}`,
      null,
      b.partId,
    );
    return {
      decisionType,
      title:
        available <= 0
          ? `Part unavailable — ${b.partId}`
          : `Reorder recommended — ${b.partId}`,
      summary: `On-hand available ${available} at or below reorder point ${b.reorderPoint} (location ${b.locationId}).`,
      detailedReasoning:
        "Stock crossed the configured reorder point. Approval may create a draft purchase request through existing inventory workflows — stock is not changed automatically.",
      sourceType: "StockBalance",
      sourceId: `${b.partId}:${b.locationId}`,
      fingerprint,
      partId: b.partId,
      inventoryLocationId: b.locationId,
      priority: priorityFromOverall(scores.overallDecisionScore),
      scores,
      estimatedCost: includeCosts
        ? Math.max(0, b.reorderQuantity) * 25
        : null,
      estimatedCostAvoidance: includeCosts ? 150 : null,
      recommendedAction:
        available <= 0
          ? "Review transfer options from other locations, then create a draft reorder if still short."
          : "Create a draft purchase/reorder request using the Inventory module after approval.",
      alternativeActions: [
        {
          action: "Propose warehouse-to-vehicle transfer",
          reason: "When another location has surplus stock (requires transfer approval).",
        },
      ],
      evidence: evidenceOf(
        [
          fact("Part ID", b.partId, "inventory"),
          fact("Location", b.locationId, "inventory"),
          fact("Quantity available", available, "inventory"),
          fact("Reorder point", b.reorderPoint, "inventory"),
          fact("Reorder quantity", b.reorderQuantity, "inventory"),
          fact(
            "Estimated unit cost used",
            includeCosts ? 25 : null,
            "inventory",
          ),
        ],
        ["LOW_STOCK"],
        [{ label: "Inventory", href: "/inventory" }],
      ),
      highImpact: markHighImpact(decisionType),
    } satisfies DraftDecision;
  });
}

export async function draftPmSchedulingDecisions(): Promise<DraftDecision[]> {
  const states = await prisma.machinePmState.findMany({
    where: { active: true },
    take: 80,
    orderBy: { updatedAt: "desc" },
  });
  const drafts: DraftDecision[] = [];
  for (const s of states) {
    if (
      s.nextPmDueCount == null ||
      s.currentMeterCount == null ||
      s.currentMeterCount < s.nextPmDueCount
    ) {
      continue;
    }
    const overBy = s.currentMeterCount - s.nextPmDueCount;
    const scores = buildScores({
      riskScore: Math.min(95, 55 + overBy / 1000),
      urgencyScore: Math.min(95, 50 + overBy / 800),
      businessImpactScore: 55,
      confidenceScore: 88,
      slaImpactScore: 40,
    });
    const decisionType = "PM_SCHEDULING" as const;
    const fingerprint = buildFingerprint(
      decisionType,
      "MachinePmState",
      s.machineId,
      s.machineId,
    );
    drafts.push({
      decisionType,
      title: `PM overdue — ${s.machineId}`,
      summary: `Meter ${s.currentMeterCount} is past PM due ${s.nextPmDueCount} (over by ${overBy}).`,
      detailedReasoning:
        "Schedule PM using the existing maintenance workflow. This recommendation does not alter PM records until a technician completes work.",
      sourceType: "MachinePmState",
      sourceId: s.machineId,
      fingerprint,
      machineId: s.machineId,
      customerId: s.customerName,
      siteId: s.siteName,
      technicianId: s.assignedTechnician,
      priority: priorityFromOverall(scores.overallDecisionScore),
      scores,
      estimatedLaborMinutes: 120,
      recommendedAction: "Schedule PM within 48 hours with the assigned technician.",
      alternativeActions: [
        {
          action: "Contact customer to plan downtime",
          reason: "High-impact customer communication — requires approval and is not sent automatically.",
        },
      ],
      evidence: evidenceOf(
        [
          fact("Machine", s.machineId, "pm"),
          fact("Current meter", s.currentMeterCount, "pm"),
          fact("Next PM due", s.nextPmDueCount, "pm"),
          fact("Over by", overBy, "pm"),
          fact("Customer", s.customerName, "pm"),
          fact("Assigned technician", s.assignedTechnician, "pm"),
        ],
        ["PM_OVERDUE_METER"],
        [{ label: "Maintenance", href: "/maintenance" }],
      ),
      highImpact: false,
      dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    });
  }
  return drafts.slice(0, 40);
}

export async function generateDecisionsForMachine(input: {
  machineId: string;
  organizationId?: string;
  actorUserId?: string | null;
  actorName?: string | null;
}): Promise<{ created: number; refreshed: number; decisionIds: string[] }> {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const snapshot = await prisma.machineHealthSnapshot.findFirst({
    where: { organizationId, machineId: input.machineId },
    orderBy: { generatedAt: "desc" },
  });

  const decisionIds: string[] = [];
  let created = 0;
  let refreshed = 0;

  if (snapshot) {
    const draft = await draftFromPredictiveSnapshot({
      machineId: input.machineId,
      healthSnapshotId: snapshot.id,
      riskLevel: snapshot.riskLevel,
      healthScore: snapshot.healthScore,
      confidenceScore: snapshot.confidenceScore,
      dataQualityScore: snapshot.dataQualityScore,
      primaryRiskReason: snapshot.primaryRiskReason,
      organizationId,
    });
    if (draft) {
      const result = await upsertDecisionRecommendation({
        draft,
        organizationId,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
      });
      decisionIds.push(result.decision.id);
      if (result.created) created += 1;
      if (result.refreshed) refreshed += 1;
    }
  }

  const pmDrafts = (await draftPmSchedulingDecisions()).filter(
    (d) => d.machineId === input.machineId,
  );
  for (const draft of pmDrafts) {
    const result = await upsertDecisionRecommendation({
      draft,
      organizationId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
    });
    decisionIds.push(result.decision.id);
    if (result.created) created += 1;
    if (result.refreshed) refreshed += 1;
  }

  return { created, refreshed, decisionIds };
}

export async function generateFromPredictiveAlert(input: {
  machineId: string;
  alertId?: string;
  healthSnapshotId?: string | null;
  riskLevel?: string;
  organizationId?: string;
  actorUserId?: string | null;
  actorName?: string | null;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const snapshot =
    (input.healthSnapshotId
      ? await prisma.machineHealthSnapshot.findUnique({
          where: { id: input.healthSnapshotId },
        })
      : null) ??
    (await prisma.machineHealthSnapshot.findFirst({
      where: { organizationId, machineId: input.machineId },
      orderBy: { generatedAt: "desc" },
    }));
  if (!snapshot) {
    return { created: 0, refreshed: 0, decisionIds: [] as string[] };
  }
  const draft = await draftFromPredictiveSnapshot({
    machineId: input.machineId,
    healthSnapshotId: snapshot.id,
    riskLevel: input.riskLevel ?? snapshot.riskLevel,
    healthScore: snapshot.healthScore,
    confidenceScore: snapshot.confidenceScore,
    dataQualityScore: snapshot.dataQualityScore,
    primaryRiskReason: snapshot.primaryRiskReason,
    organizationId,
  });
  if (!draft) {
    return { created: 0, refreshed: 0, decisionIds: [] as string[] };
  }
  if (input.alertId) {
    draft.sourceType = "PredictiveRiskAlert";
    draft.sourceId = input.alertId;
    draft.fingerprint = buildFingerprint(
      draft.decisionType,
      "PredictiveRiskAlert",
      input.alertId,
      input.machineId,
    );
  }
  const result = await upsertDecisionRecommendation({
    draft,
    organizationId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
  });
  return {
    created: result.created ? 1 : 0,
    refreshed: result.refreshed ? 1 : 0,
    decisionIds: [result.decision.id],
  };
}

export async function runDecisionEngineBatch(input?: {
  organizationId?: string;
  actorUserId?: string | null;
  actorName?: string | null;
  includeInventoryCosts?: boolean;
  scopes?: Array<
    "predictive" | "sla" | "repeat" | "inventory" | "pm" | "expire"
  >;
}): Promise<{
  created: number;
  refreshed: number;
  expired: number;
  decisionIds: string[];
}> {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const settings = await getOrCreateDecisionSettings(organizationId);
  if (!settings.enabled) {
    return { created: 0, refreshed: 0, expired: 0, decisionIds: [] };
  }
  // Ensure weights are loadable (documented for scoring); batch uses defaults in drafts
  weightsFromSettings(settings);

  const scopes = input?.scopes ?? [
    "predictive",
    "sla",
    "repeat",
    "inventory",
    "pm",
    "expire",
  ];
  let created = 0;
  let refreshed = 0;
  let expired = 0;
  const decisionIds: string[] = [];

  if (scopes.includes("expire")) {
    const exp = await expireStaleDecisions(organizationId);
    expired = exp.expired;
  }

  const drafts: DraftDecision[] = [];

  if (scopes.includes("predictive")) {
    const snapshots = await prisma.machineHealthSnapshot.findMany({
      where: { organizationId },
      orderBy: { generatedAt: "desc" },
      take: 300,
    });
    const latest = new Map<string, (typeof snapshots)[0]>();
    for (const s of snapshots) {
      if (!latest.has(s.machineId)) latest.set(s.machineId, s);
    }
    for (const s of latest.values()) {
      const d = await draftFromPredictiveSnapshot({
        machineId: s.machineId,
        healthSnapshotId: s.id,
        riskLevel: s.riskLevel,
        healthScore: s.healthScore,
        confidenceScore: s.confidenceScore,
        dataQualityScore: s.dataQualityScore,
        primaryRiskReason: s.primaryRiskReason,
        organizationId,
      });
      if (d) drafts.push(d);
    }
  }
  if (scopes.includes("sla")) {
    drafts.push(...(await draftSlaRiskFromServiceCalls()));
  }
  if (scopes.includes("repeat")) {
    drafts.push(...(await draftRepeatFailureDecisions()));
  }
  if (scopes.includes("inventory")) {
    drafts.push(
      ...(await draftInventoryDecisions(Boolean(input?.includeInventoryCosts))),
    );
  }
  if (scopes.includes("pm")) {
    drafts.push(...(await draftPmSchedulingDecisions()));
  }

  for (const draft of drafts) {
    const result = await upsertDecisionRecommendation({
      draft,
      organizationId,
      actorUserId: input?.actorUserId,
      actorName: input?.actorName,
    });
    decisionIds.push(result.decision.id);
    if (result.created) created += 1;
    if (result.refreshed) refreshed += 1;
  }

  return { created, refreshed, expired, decisionIds };
}
