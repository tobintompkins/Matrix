/**
 * Patch 51A.5 Part 1 — Server-side executive summary aggregation.
 * Reads existing Matrix modules; does not become a new source of truth.
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { listServiceCalls } from "@/lib/service-calls";
import { listTechnicians } from "@/lib/service-dispatch";
import { digitalTwinFleet } from "@/lib/digital-twin";
import { OPEN_DECISION_STATUSES } from "@/lib/decision-engine/types";
import { computeExecutiveFleetHealth } from "./fleet-health";
import { prioritySortKey, sortExecutivePriorities } from "./priorities";
import { buildExecutiveBriefing } from "./briefing";
import { isEnterpriseIntelligence51c1Enabled } from "./feature-flag";
import { getOrgHealthBridge } from "./org-health-bridge";
import type {
  EnterpriseStatusPanel,
  ExecutiveCommandCenterSummary,
  ExecutivePriorityItem,
} from "./types";

const OPEN_CALL_STATUSES = new Set([
  "NEW",
  "UNASSIGNED",
  "ASSIGNED",
  "ACCEPTED",
  "EN_ROUTE",
  "ON_SITE",
  "DIAGNOSING",
  "WAITING_FOR_PARTS",
  "WAITING_FOR_CUSTOMER",
  "ESCALATED",
]);

export async function getExecutiveCommandCenterSummary(
  organizationId = DEFAULT_ORG_ID,
): Promise<ExecutiveCommandCenterSummary> {
  const generatedAt = new Date().toISOString();

  const calls = listServiceCalls({ includeDeleted: false });
  const openCalls = calls.filter((c) => OPEN_CALL_STATUSES.has(c.status));
  const criticalCalls = openCalls.filter(
    (c) =>
      c.priority === "CRITICAL" ||
      c.priority === "EMERGENCY" ||
      c.priority === "URGENT" ||
      c.problem.machineCurrentlyDown,
  );

  const [pmStates, healthSnapshots, predictiveAlerts, openDecisions, failedAutomations] =
    await Promise.all([
      prisma.machinePmState.findMany({
        where: { active: true },
        take: 500,
        select: {
          machineId: true,
          customerName: true,
          siteName: true,
          currentMeterCount: true,
          nextPmDueCount: true,
          assignedTechnician: true,
        },
      }),
      prisma.machineHealthSnapshot.findMany({
        where: { organizationId },
        orderBy: { generatedAt: "desc" },
        take: 400,
        select: {
          id: true,
          machineId: true,
          riskLevel: true,
          healthScore: true,
          primaryRiskReason: true,
          generatedAt: true,
        },
      }),
      prisma.predictiveRiskAlert.findMany({
        where: {
          organizationId,
          status: "OPEN",
          severity: { in: ["CRITICAL", "HIGH"] },
        },
        orderBy: { openedAt: "desc" },
        take: 50,
        select: {
          id: true,
          machineId: true,
          title: true,
          message: true,
          severity: true,
          openedAt: true,
        },
      }),
      prisma.decisionRecommendation.findMany({
        where: {
          organizationId,
          status: { in: OPEN_DECISION_STATUSES },
          priority: { in: ["CRITICAL", "HIGH"] },
        },
        orderBy: { overallDecisionScore: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          summary: true,
          recommendedAction: true,
          priority: true,
          machineId: true,
          customerId: true,
          siteId: true,
          createdAt: true,
        },
      }),
      prisma.aiOpsAutomationExecution
        .findMany({
          where: {
            organizationId,
            status: { in: ["FAILED", "WAITING_APPROVAL"] },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            status: true,
            errorJson: true,
            startedAt: true,
            createdAt: true,
            automationId: true,
          },
        })
        .catch(() => [] as Array<{
          id: string;
          status: string;
          errorJson: string | null;
          startedAt: Date | null;
          createdAt: Date;
          automationId: string;
        }>),
    ]);

  const latestHealth = new Map<string, (typeof healthSnapshots)[0]>();
  for (const s of healthSnapshots) {
    if (!latestHealth.has(s.machineId)) latestHealth.set(s.machineId, s);
  }
  const atRisk = [...latestHealth.values()].filter(
    (s) => s.riskLevel === "HIGH" || s.riskLevel === "CRITICAL",
  );

  const pmOverdue = pmStates.filter(
    (s) =>
      s.nextPmDueCount != null &&
      s.currentMeterCount != null &&
      s.currentMeterCount >= s.nextPmDueCount,
  );
  const pmDueSoon = pmStates.filter((s) => {
    if (
      s.nextPmDueCount == null ||
      s.currentMeterCount == null ||
      s.currentMeterCount >= s.nextPmDueCount
    ) {
      return false;
    }
    const remaining = s.nextPmDueCount - s.currentMeterCount;
    return remaining <= 10_000;
  });

  const pmMachineIds = new Set(pmStates.map((s) => s.machineId));
  const twinActive = digitalTwinFleet.filter(
    (m) => m.operational.status !== "RETIRED",
  ).length;
  const activeMachines = Math.max(pmMachineIds.size, twinActive);

  const technicians = listTechnicians();
  const activeTechnicians = technicians.filter((t) =>
    ["AVAILABLE", "ON_SITE", "TRAVELING", "ASSIGNED"].includes(t.status),
  ).length;
  const available = technicians.filter((t) => t.status === "AVAILABLE").length;
  const technicianCoverageLabel =
    technicians.length === 0
      ? "No technician roster loaded"
      : `${available} available of ${technicians.length}`;

  const signalsPresent = [
    activeMachines > 0,
    openCalls.length > 0 || calls.length > 0,
    pmStates.length > 0,
    latestHealth.size > 0,
    technicians.length > 0,
  ];
  const dataCompleteness = Math.round(
    (signalsPresent.filter(Boolean).length / signalsPresent.length) * 100,
  );

  const fleetHealth = computeExecutiveFleetHealth({
    activeMachines,
    criticalServiceCalls: criticalCalls.length,
    openServiceCalls: openCalls.length,
    pmOverdue: pmOverdue.length,
    machinesAtRisk: atRisk.length,
    criticalAlerts: predictiveAlerts.filter((a) => a.severity === "CRITICAL")
      .length,
    dataFreshnessScore: dataCompleteness,
  });

  const priorities: ExecutivePriorityItem[] = [];

  for (const c of criticalCalls.slice(0, 10)) {
    const severity =
      c.priority === "CRITICAL" || c.priority === "EMERGENCY"
        ? ("CRITICAL" as const)
        : ("HIGH" as const);
    priorities.push({
      id: `sc-${c.id}`,
      severity,
      title: `${c.ticketNumber || c.id}: ${c.problem.issueTitle || "Service call"}`,
      reason: c.problem.machineCurrentlyDown
        ? "Machine reported down / high priority open call."
        : `Open ${c.priority} service call needs attention.`,
      recommendedNextStep: c.assignment.technician
        ? "Confirm progress with assigned technician."
        : "Assign a technician in Dispatch / Service Calls.",
      href: `/service-calls`,
      source: "Service",
      customerName: c.machine.customerName,
      siteName: c.machine.siteName,
      machineId: c.machine.machineId,
      createdAt: c.createdAt,
      sortKey: prioritySortKey(severity, true, c.createdAt),
    });
  }

  for (const m of atRisk.slice(0, 8)) {
    const severity = m.riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH";
    priorities.push({
      id: `pred-${m.machineId}`,
      severity,
      title: `${m.riskLevel} predictive risk — ${m.machineId}`,
      reason:
        m.primaryRiskReason ??
        `Health score ${m.healthScore}; review predictive details.`,
      recommendedNextStep: "Open predictive machine view and schedule inspection/PM.",
      href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(m.machineId)}`,
      source: "Predictive Maintenance",
      machineId: m.machineId,
      createdAt: m.generatedAt.toISOString(),
      sortKey: prioritySortKey(severity, false, m.generatedAt.toISOString()),
    });
  }

  for (const p of pmOverdue.slice(0, 8)) {
    priorities.push({
      id: `pm-${p.machineId}`,
      severity: "HIGH",
      title: `PM overdue — ${p.machineId}`,
      reason: `Meter ${p.currentMeterCount} is past due target ${p.nextPmDueCount}.`,
      recommendedNextStep: "Schedule PM in Maintenance within 48 hours.",
      href: `/maintenance`,
      source: "Preventive Maintenance",
      customerName: p.customerName,
      siteName: p.siteName,
      machineId: p.machineId,
      createdAt: null,
      sortKey: prioritySortKey("HIGH", true, null),
    });
  }

  for (const d of openDecisions.slice(0, 8)) {
    const severity = d.priority === "CRITICAL" ? "CRITICAL" : "HIGH";
    priorities.push({
      id: `dec-${d.id}`,
      severity,
      title: d.title,
      reason: d.summary,
      recommendedNextStep: d.recommendedAction,
      href: `/ai-operations/decisions/${d.id}`,
      source: "Decision Engine",
      customerName: d.customerId,
      siteName: d.siteId,
      machineId: d.machineId,
      createdAt: d.createdAt.toISOString(),
      sortKey: prioritySortKey(severity, false, d.createdAt.toISOString()),
    });
  }

  for (const a of failedAutomations.slice(0, 5)) {
    const when = (a.startedAt ?? a.createdAt).toISOString();
    let errorText: string | null = null;
    try {
      if (a.errorJson) {
        const parsed = JSON.parse(a.errorJson) as { message?: string };
        errorText = parsed.message ?? a.errorJson.slice(0, 160);
      }
    } catch {
      errorText = a.errorJson?.slice(0, 160) ?? null;
    }
    priorities.push({
      id: `auto-${a.id}`,
      severity: a.status === "FAILED" ? "HIGH" : "MEDIUM",
      title: `Automation ${a.status.toLowerCase()}`,
      reason: errorText ?? "Automation run needs review.",
      recommendedNextStep: "Open Automations history and resolve the blocked run.",
      href: `/ai-operations/automations`,
      source: "Automation",
      createdAt: when,
      sortKey: prioritySortKey(
        a.status === "FAILED" ? "HIGH" : "MEDIUM",
        false,
        when,
      ),
    });
  }

  const sortedPriorities = sortExecutivePriorities(priorities);

  const kpis = {
    activeMachines,
    openServiceCalls: openCalls.length,
    criticalServiceCalls: criticalCalls.length,
    machinesAtRisk: atRisk.length,
    pmDue: pmDueSoon.length + pmOverdue.length,
    pmOverdue: pmOverdue.length,
    criticalAlerts: predictiveAlerts.length,
    activeTechnicians,
    technicianCoverageLabel,
  };

  const aiBriefing = buildExecutiveBriefing({
    kpis,
    fleetHealth,
    priorities: sortedPriorities,
  });

  const panels: EnterpriseStatusPanel[] = [
    {
      key: "fleet",
      title: "Fleet Health Overview",
      status:
        fleetHealth.status === "critical"
          ? "attention"
          : fleetHealth.status === "watch"
            ? "watch"
            : fleetHealth.status === "unknown"
              ? "unknown"
              : "ok",
      headline:
        fleetHealth.score == null
          ? "Score unavailable — add active machines"
          : `Score ${fleetHealth.score} · ${fleetHealth.status}`,
      items: [
        { label: "Active machines", value: String(activeMachines), href: "/fleet" },
        { label: "At predictive risk", value: String(atRisk.length) },
        {
          label: "Explain factors",
          value: String(fleetHealth.factors.length),
          href: "/executive-command-center?focus=fleet",
        },
      ],
      href: "/executive-command-center",
    },
    {
      key: "service",
      title: "Service Operations",
      status:
        criticalCalls.length > 0
          ? "attention"
          : openCalls.length > 5
            ? "watch"
            : "ok",
      headline: `${openCalls.length} open · ${criticalCalls.length} critical`,
      items: openCalls.slice(0, 3).map((c) => ({
        label: c.ticketNumber || c.id,
        value: c.priority,
        href: "/service-calls",
      })),
      href: "/service-calls",
    },
    {
      key: "pm",
      title: "Preventive Maintenance",
      status: pmOverdue.length > 0 ? "attention" : pmDueSoon.length > 0 ? "watch" : "ok",
      headline: `${pmOverdue.length} overdue · ${pmDueSoon.length} approaching`,
      items: pmOverdue.slice(0, 3).map((p) => ({
        label: p.machineId,
        value: "Overdue",
        href: "/maintenance",
      })),
      href: "/maintenance",
    },
    {
      key: "predictive",
      title: "Predictive Risk",
      status: atRisk.some((r) => r.riskLevel === "CRITICAL")
        ? "attention"
        : atRisk.length > 0
          ? "watch"
          : latestHealth.size === 0
            ? "unknown"
            : "ok",
      headline:
        latestHealth.size === 0
          ? "No predictive evaluations yet"
          : `${atRisk.length} high/critical machines`,
      items: atRisk.slice(0, 3).map((r) => ({
        label: r.machineId,
        value: r.riskLevel,
        href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(r.machineId)}`,
      })),
      href: "/ai-operations/predictive-maintenance",
    },
    {
      key: "technicians",
      title: "Technician Coverage",
      status:
        technicians.length === 0
          ? "unknown"
          : available === 0
            ? "watch"
            : "ok",
      headline: technicianCoverageLabel,
      items: technicians.slice(0, 3).map((t) => ({
        label: t.name,
        value: t.status,
        href: "/field",
      })),
      href: "/executive-command-center/technicians",
    },
    {
      key: "ai",
      title: "AI / Automation Status",
      status:
        failedAutomations.length > 0
          ? "watch"
          : openDecisions.length > 0
            ? "watch"
            : "ok",
      headline: `${openDecisions.length} open high-priority decisions · ${failedAutomations.length} automation issues`,
      items: [
        {
          label: "Decision Engine",
          value: String(openDecisions.length),
          href: "/ai-operations/decisions",
        },
        {
          label: "Automations",
          value: String(failedAutomations.length),
          href: "/ai-operations/automations",
        },
      ],
      href: "/ai-operations",
    },
  ];

  const eiEnabled = isEnterpriseIntelligence51c1Enabled();
  let organizationHealth: ExecutiveCommandCenterSummary["organizationHealth"] =
    null;
  if (eiEnabled) {
    const bridge = await getOrgHealthBridge(organizationId);
    organizationHealth = {
      enabled: bridge.enabled,
      overallScore: bridge.overallScore,
      classification: bridge.classification,
      availableCategories: bridge.availableCategories,
      href: bridge.href,
      message: bridge.message,
    };
    if (bridge.enabled) {
      panels.unshift({
        key: "organizationHealth",
        title: "Organization Health",
        status:
          bridge.classification === "Critical" ||
          bridge.classification === "At Risk"
            ? "attention"
            : bridge.classification === "Watch"
              ? "watch"
              : bridge.overallScore == null
                ? "unknown"
                : "ok",
        headline:
          bridge.overallScore == null
            ? bridge.message ?? "Score unavailable"
            : `Score ${bridge.overallScore} · ${bridge.classification}`,
        items: bridge.kpis.slice(0, 3).map((k) => ({
          label: k.label,
          value: k.value,
          href: bridge.href,
        })),
        href: bridge.href,
      });
    }
  }

  const recommendations = sortedPriorities
    .filter(
      (p) =>
        p.source === "Decision Engine" ||
        p.source === "Predictive Maintenance",
    )
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      title: p.title,
      reason: p.reason,
      href: p.href,
      source: p.source,
      severity: p.severity,
    }));

  const empty =
    activeMachines === 0 &&
    openCalls.length === 0 &&
    pmStates.length === 0 &&
    atRisk.length === 0;

  return {
    generatedAt,
    dataCompleteness,
    dataStatus:
      dataCompleteness >= 80 ? "live" : dataCompleteness >= 40 ? "partial" : "empty",
    fleetHealth,
    organizationHealth,
    recommendations,
    enterpriseIntelligenceEnabled: eiEnabled,
    kpis,
    priorities: sortedPriorities,
    aiBriefing,
    panels,
    empty,
    emptyMessage: empty
      ? "No operational records are loaded yet. Matrix will show KPIs and priorities here once fleet, service, PM, or predictive data is available."
      : null,
  };
}
