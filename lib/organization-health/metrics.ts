/**
 * Patch 50B — Live category metrics from existing Matrix systems.
 */

import { listServiceCalls } from "@/lib/service-calls";
import { computeServiceCallMetrics } from "@/lib/service-calls/helpers";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { listAdminMachines } from "@/lib/admin/data/machines";
import { listCustomers } from "@/lib/crm/repository";
import { getDashboardMetrics } from "@/lib/inventory/enterprise-repository";
import { getPmDashboard } from "@/lib/pm-intelligence/repository";
import { prisma } from "@/lib/db/prisma";
import type { AdminActor } from "@/lib/admin/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import type { CategoryScoreInput, HealthSettings } from "./score";

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 100) / 100));
}

export async function collectCategoryInputs(
  actor: AdminActor,
  settings: HealthSettings,
): Promise<{
  inputs: CategoryScoreInput[];
  kpis: Record<string, number | string | null>;
  drilldowns: Record<string, unknown>;
  approvalMetrics: Record<string, number>;
  portalMetrics: Record<string, number>;
  freshness: string;
}> {
  const calculatedAt = new Date().toISOString();
  const calls = listServiceCalls({ includeDeleted: false, includeArchived: false });
  const openCalls = calls.filter((c) => isOpenServiceCallStatus(c.status));
  const criticalOpen = openCalls.filter(
    (c) => c.priority === "EMERGENCY" || c.priority === "URGENT" || c.priority === "CRITICAL",
  );
  const unassigned = openCalls.filter((c) => !c.assignment.technician?.trim());
  const waitingParts = openCalls.filter(
    (c) =>
      String(c.status).includes("WAITING") ||
      String(c.status) === "WAITING_FOR_PARTS",
  );
  const portalSourced = calls.filter(
    (c) =>
      /portal|customer/i.test(c.createdBy) ||
      c.notes.some((n) => /customer portal/i.test(n.body)),
  );
  const serviceMetrics = computeServiceCallMetrics(calls);

  const machines = listAdminMachines({ recordState: "ACTIVE", pageSize: 5000 });
  const operational = machines.items.filter(
    (m) => m.status !== "DOWN" && m.status !== "RETIRED" && m.status !== "OFFLINE",
  );
  const attention = machines.items.filter(
    (m) =>
      m.status === "DOWN" ||
      m.status === "SERVICE_REQUIRED" ||
      m.status === "DEGRADED" ||
      m.status === "OFFLINE",
  );
  const down = machines.items.filter((m) => m.status === "DOWN");
  const machinesWithCritical = new Set(
    criticalOpen.map((c) => c.machine.machineId?.toLowerCase()).filter(Boolean),
  );
  const fleetAvailability =
    machines.items.length === 0
      ? null
      : clampScore((operational.length / machines.items.length) * 100);

  const pmDash = getPmDashboard();
  const pm = pmDash.metrics;
  const inv = getDashboardMetrics();
  const customers = listCustomers(1, 500);

  // Technician productivity from open call assignments (aggregate)
  const byTech = new Map<string, { open: number; overdue: number }>();
  for (const call of openCalls) {
    const tech = call.assignment.technician?.trim() || "Unassigned";
    const row = byTech.get(tech) ?? { open: 0, overdue: 0 };
    row.open += 1;
    const ageDays =
      (Date.now() - new Date(call.createdAt).getTime()) / 86_400_000;
    if (ageDays > 7) row.overdue += 1;
    byTech.set(tech, row);
  }
  const techs = [...byTech.entries()].filter(([name]) => name !== "Unassigned");
  const overloaded = techs.filter(
    ([, v]) => v.overdue >= settings.technicianOverdueWatchAbove,
  ).length;
  const techScore =
    techs.length === 0
      ? null
      : clampScore(100 - Math.min(60, overloaded * 15 + unassigned.length * 2));

  // Customer risk from open critical / aging calls
  const byCustomer = new Map<string, { open: number; critical: number }>();
  for (const call of openCalls) {
    const name = call.machine.customerName || call.assignment.organization || "Unknown";
    const row = byCustomer.get(name) ?? { open: 0, critical: 0 };
    row.open += 1;
    if (
      call.priority === "EMERGENCY" ||
      call.priority === "URGENT" ||
      call.priority === "CRITICAL"
    ) {
      row.critical += 1;
    }
    byCustomer.set(name, row);
  }
  const atRiskCustomers = [...byCustomer.values()].filter(
    (c) => c.critical >= settings.customerCriticalCallsWatchAbove || c.open >= 5,
  ).length;
  const customerScore =
    customers.total === 0 && byCustomer.size === 0
      ? null
      : clampScore(
          100 -
            Math.min(
              70,
              atRiskCustomers * 8 + criticalOpen.length * 2,
            ),
        );

  // Approvals (50A)
  let pendingApprovals = 0;
  let criticalApprovals = 0;
  let overdueApprovals = 0;
  try {
    const now = new Date();
    const where = {
      organizationId: actor.organizationId,
      status: { in: ["PENDING", "IN_REVIEW", "ESCALATED"] as string[] },
    };
    pendingApprovals = await prisma.approvalRequest.count({ where });
    criticalApprovals = await prisma.approvalRequest.count({
      where: { ...where, priority: "CRITICAL" },
    });
    overdueApprovals = await prisma.approvalRequest.count({
      where: { ...where, dueAt: { lt: now } },
    });
  } catch {
    /* Approval Center optional if migration not applied */
  }

  // Portal memberships (51B)
  let portalActiveUsers = 0;
  let portalInvited = 0;
  try {
    portalActiveUsers = await prisma.customerMembership.count({
      where: { status: "ACTIVE" },
    });
    portalInvited = await prisma.customerMembership.count({
      where: { status: "INVITED" },
    });
  } catch {
    /* portal tables optional */
  }

  let portalPartsPending = 0;
  try {
    portalPartsPending = await prisma.portalPartsRequest.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "PENDING"] } },
    });
  } catch {
    /* optional */
  }

  // Financial — only if inventory value exists; never invent revenue
  const invAny = inv as unknown as {
    totalInventoryValue?: number;
    inventoryValue?: number;
    inventoryAccuracyPct?: number;
  };
  const inventoryValue =
    typeof invAny.totalInventoryValue === "number"
      ? invAny.totalInventoryValue
      : typeof invAny.inventoryValue === "number"
        ? invAny.inventoryValue
        : null;
  const financialAvailable =
    inventoryValue != null || pendingApprovals > 0 || portalPartsPending > 0;
  const financialScore = financialAvailable
    ? clampScore(
        100 -
          Math.min(
            50,
            overdueApprovals * 5 +
              criticalApprovals * 3 +
              (inv.outOfStock ?? 0) * 2,
          ),
      )
    : null;

  // Security / admin summary
  let activeUsers = 0;
  let suspendedUsers = 0;
  try {
    activeUsers = await prisma.user.count({
      where: { status: "active", deletedAt: null },
    });
  } catch {
    try {
      activeUsers = await prisma.user.count();
    } catch {
      activeUsers = 0;
    }
  }
  try {
    suspendedUsers = await prisma.customerMembership.count({
      where: { status: "DISABLED" },
    });
  } catch {
    suspendedUsers = 0;
  }
  const securityScore = clampScore(
    100 -
      Math.min(
        40,
        overdueApprovals * 4 +
          criticalApprovals * 3 +
          portalInvited * 0.5,
      ),
  );

  const fleetScore =
    fleetAvailability == null
      ? null
      : clampScore(
          fleetAvailability -
            Math.min(30, down.length * 3 + machinesWithCritical.size * 2),
        );

  const openRatio =
    calls.length === 0 ? 0 : openCalls.length / Math.max(calls.length, 1);
  const serviceScore = clampScore(
    100 -
      Math.min(
        70,
        criticalOpen.length * 4 +
          unassigned.length * 3 +
          waitingParts.length * 2 +
          openRatio * 40,
      ),
  );

  const pmCompliance =
    typeof pm.pmCompliancePercent === "number" ? pm.pmCompliancePercent : null;
  const pmScore =
    pmCompliance == null
      ? null
      : clampScore(pmCompliance - Math.min(25, (pm.overduePms ?? 0) * 2));

  const stockout = inv.outOfStock ?? 0;
  const lowStock = inv.lowStock ?? 0;
  const inventoryScore = clampScore(
    100 - Math.min(70, stockout * 8 + lowStock * 2 + portalPartsPending),
  );

  const inputs: CategoryScoreInput[] = [
    {
      key: "fleet",
      score: fleetScore,
      available: fleetScore != null && machines.items.length > 0,
      currentValue: fleetAvailability,
      targetValue: 95,
      trend: "unknown",
      dataPeriod: "Live",
      dataSource: "Machines + open service calls",
      positiveFactors: [
        `${operational.length} operational machines`,
        `${machines.items.length} active fleet machines`,
      ],
      negativeFactors: [
        ...(down.length ? [`${down.length} out of service`] : []),
        ...(machinesWithCritical.size
          ? [`${machinesWithCritical.size} with critical open calls`]
          : []),
      ],
      recommendedActions: [
        ...(down.length ? ["Review out-of-service machines"] : []),
        ...(machinesWithCritical.size
          ? ["Prioritize critical machine-down calls"]
          : []),
      ],
    },
    {
      key: "service",
      score: serviceScore,
      available: true,
      currentValue: openCalls.length,
      targetValue: "Minimize open critical backlog",
      dataPeriod: "Live",
      dataSource: "Service calls (includes Customer Portal sourced)",
      positiveFactors: [
        `${serviceMetrics.closedThisWeek ?? 0} closed this week`,
        `${portalSourced.length} portal-sourced historical requests included via service calls`,
      ],
      negativeFactors: [
        `${criticalOpen.length} critical open`,
        `${unassigned.length} unassigned`,
        `${waitingParts.length} waiting for parts`,
      ],
      recommendedActions: [
        ...(unassigned.length ? ["Assign unassigned high-priority calls"] : []),
        ...(waitingParts.length ? ["Review parts-blocked calls"] : []),
      ],
    },
    {
      key: "pm",
      score: pmScore,
      available: pmScore != null,
      currentValue: pmCompliance,
      targetValue: settings.pmComplianceWatchBelow,
      dataPeriod: "Live",
      dataSource: "PM Intelligence dashboard",
      positiveFactors: [`${pm.machinesCurrentOnPm ?? 0} machines current on PM`],
      negativeFactors: [
        `${pm.overduePms ?? 0} overdue PMs`,
        `${pm.pmsDueNow ?? 0} due now`,
        `${pm.meterUpdatesNeeded ?? 0} meters needing update`,
      ],
      recommendedActions: [
        ...(pm.overduePms ? ["Assign overdue PM work"] : []),
        ...(pm.meterUpdatesNeeded
          ? ["Request missing meter readings"]
          : []),
      ],
    },
    {
      key: "inventory",
      score: inventoryScore,
      available: true,
      currentValue: stockout,
      targetValue: 0,
      dataPeriod: "Live",
      dataSource: "Enterprise inventory + portal parts requests",
      positiveFactors: [`${inv.totalParts ?? 0} catalog items tracked`],
      negativeFactors: [
        `${stockout} out of stock`,
        `${lowStock} low stock`,
        `${portalPartsPending} customer parts requests awaiting review`,
      ],
      recommendedActions: [
        ...(stockout ? ["Reorder critical out-of-stock parts"] : []),
        ...(portalPartsPending
          ? ["Review customer portal parts requests"]
          : []),
      ],
    },
    {
      key: "technician",
      score: techScore,
      available: techScore != null,
      currentValue: techs.length,
      targetValue: "Balanced workload",
      dataPeriod: "Live",
      dataSource: "Service call assignments",
      positiveFactors: [`${techs.length} technicians with assignments`],
      negativeFactors: [
        `${overloaded} technicians over overdue threshold`,
        `${unassigned.length} unassigned calls`,
      ],
      recommendedActions: [
        ...(overloaded ? ["Rebalance overdue workloads"] : []),
        ...(unassigned.length ? ["Assign open unassigned work"] : []),
      ],
    },
    {
      key: "customer",
      score: customerScore,
      available: customerScore != null,
      currentValue: atRiskCustomers,
      targetValue: 0,
      dataPeriod: "Live",
      dataSource: "CRM customers + open service risk (not satisfaction surveys)",
      positiveFactors: [
        `${customers.total || byCustomer.size} customer accounts in scope`,
        `${portalActiveUsers} active portal users`,
      ],
      negativeFactors: [
        `${atRiskCustomers} at-risk accounts (service risk)`,
        `${criticalOpen.length} critical open calls`,
      ],
      recommendedActions: [
        ...(atRiskCustomers
          ? ["Review at-risk customer open critical work"]
          : []),
      ],
    },
    {
      key: "financial",
      score: financialScore,
      available: financialScore != null,
      currentValue: inventoryValue,
      targetValue: null,
      dataPeriod: "Live",
      dataSource:
        inventoryValue != null
          ? "Inventory valuation + approval backlog"
          : "Approval / parts request backlog only (no full ledger)",
      positiveFactors: inventoryValue != null
        ? [`Inventory value available: ${inventoryValue}`]
        : ["Financial ledger not configured — using operational cost proxies only"],
      negativeFactors: [
        `${overdueApprovals} overdue approvals`,
        `${pendingApprovals} pending approvals`,
      ],
      recommendedActions: [
        ...(overdueApprovals
          ? ["Clear overdue Approval Center requests"]
          : []),
      ],
    },
    {
      key: "security",
      score: securityScore,
      available: true,
      currentValue: pendingApprovals,
      targetValue: 0,
      dataPeriod: "Live",
      dataSource: "Users, portal access, Approval Center (summary only)",
      positiveFactors: [`${activeUsers || "—"} users counted`],
      negativeFactors: [
        `${overdueApprovals} overdue approvals`,
        `${suspendedUsers} suspended/disabled portal memberships`,
        `${portalInvited} pending portal invitations`,
      ],
      recommendedActions: [
        ...(overdueApprovals ? ["Review overdue privileged approvals"] : []),
      ],
    },
  ];

  const includeIndividualTech = hasMatrixPermission(
    actor.role,
    "VIEW_TECHNICIAN_PRODUCTIVITY",
  );

  return {
    inputs,
    kpis: {
      overallOpenCalls: openCalls.length,
      criticalOpenCalls: criticalOpen.length,
      fleetAvailability,
      pmCompliance,
      inventoryOutOfStock: stockout,
      inventoryLowStock: lowStock,
      unassignedCalls: unassigned.length,
      waitingForParts: waitingParts.length,
      atRiskCustomers,
      pendingApprovals,
      criticalApprovals,
      overdueApprovals,
      portalActiveUsers,
      portalSourcedCalls: portalSourced.length,
      portalPartsPending,
      activeMachines: machines.items.length,
      machinesAttention: attention.length,
    },
    drilldowns: {
      fleet: machines.items.slice(0, 200).map((m) => ({
        id: m.machineId,
        name: m.nickname || m.serialNumber || m.machineId,
        model: m.printerModel ?? "",
        serial: m.serialNumber ?? "",
        customer: m.customerName ?? "",
        location: m.siteName ?? "",
        status: m.status,
        health:
          m.status === "DOWN"
            ? "Critical"
            : attention.some((a) => a.machineId === m.machineId)
              ? "Watch"
              : "Healthy",
      })),
      service: openCalls.slice(0, 200).map((c) => ({
        id: c.id,
        number: c.ticketNumber || c.workOrderNumber || c.id,
        customer: c.machine.customerName || c.assignment.organization || "",
        machine: c.machine.machineId ?? "",
        issue: c.problem.issueTitle || c.problem.problemDescription || "",
        priority: c.priority,
        status: c.status,
        technician: c.assignment.technician ?? "",
        opened: c.createdAt,
        source: /portal|customer/i.test(c.createdBy)
          ? "Customer Portal"
          : "Internal",
        ageDays: Math.floor(
          (Date.now() - new Date(c.createdAt).getTime()) / 86_400_000,
        ),
      })),
      pm: {
        compliancePercent: pmCompliance,
        overdue: pm.overduePms ?? 0,
        dueSoon: pm.pmsDueSoon ?? 0,
        dueNow: pm.pmsDueNow ?? 0,
        meterUpdatesNeeded: pm.meterUpdatesNeeded ?? 0,
        pendingPmApprovals: overdueApprovals, // approximate link; detail in Approval Center
      },
      inventory: {
        outOfStock: stockout,
        lowStock,
        portalPartsPending,
        accuracy: invAny.inventoryAccuracyPct ?? null,
      },
      technicians: includeIndividualTech
        ? techs.map(([name, v]) => ({
            technician: name,
            openCalls: v.open,
            overdueCalls: v.overdue,
          }))
        : [
            {
              technician: "Team aggregate",
              openCalls: openCalls.length,
              overdueCalls: techs.reduce((s, [, v]) => s + v.overdue, 0),
              note: "Individual productivity hidden for this role",
            },
          ],
      customers: [...byCustomer.entries()]
        .sort((a, b) => b[1].critical - a[1].critical || b[1].open - a[1].open)
        .slice(0, 100)
        .map(([name, v]) => ({
          customer: name,
          openCalls: v.open,
          criticalCalls: v.critical,
          risk:
            v.critical >= settings.customerCriticalCallsWatchAbove
              ? "High"
              : v.open >= 5
                ? "Watch"
                : "Normal",
        })),
    },
    approvalMetrics: {
      pendingApprovals,
      criticalApprovals,
      overdueApprovals,
    },
    portalMetrics: {
      portalActiveUsers,
      portalInvited,
      portalSourcedCalls: portalSourced.length,
      portalPartsPending,
    },
    freshness: `Live · calculated at ${calculatedAt}`,
  };
}
