/**
 * Patch 51C.2 — Machine reliability trends from service calls + health snapshots.
 * Complements (does not replace) predictive-maintenance scoring.
 */

import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import type { ForecastMeta } from "./types";
import { buildMeta } from "./forecasting";

export type MachineReliabilityTrends = {
  meta: ForecastMeta;
  actual: {
    machinesWithCalls: number;
    repeatCallMachines: number;
    openDownCalls: number;
    firstTimeFixRate: number | null;
  };
  machines: Array<{
    machineId: string;
    customerName: string | null;
    callCount90d: number;
    openCalls: number;
    healthScore: number | null;
    riskLevel: string | null;
    repeatFlag: boolean;
    href: string;
  }>;
};

export async function getMachineReliabilityTrends(input?: {
  organizationId?: string;
  now?: Date;
}): Promise<MachineReliabilityTrends> {
  const organizationId = input?.organizationId ?? DEFAULT_ORG_ID;
  const now = input?.now ?? new Date();
  const start90 = now.getTime() - 90 * 86_400_000;

  const calls = listServiceCalls({ includeDeleted: false });
  const recent = calls.filter(
    (c) => new Date(c.createdAt).getTime() >= start90,
  );

  const byMachine = new Map<
    string,
    { customerName: string | null; count: number; open: number; closed: number }
  >();
  for (const c of recent) {
    const mid = (c.machine.machineId || c.id).trim();
    if (!mid) continue;
    const row = byMachine.get(mid) ?? {
      customerName: c.machine.customerName ?? null,
      count: 0,
      open: 0,
      closed: 0,
    };
    row.count += 1;
    if (isOpenServiceCallStatus(c.status)) row.open += 1;
    else row.closed += 1;
    byMachine.set(mid, row);
  }

  const snapshots = await prisma.machineHealthSnapshot.findMany({
    where: { organizationId },
    orderBy: { generatedAt: "desc" },
    take: 400,
    select: {
      machineId: true,
      healthScore: true,
      riskLevel: true,
      generatedAt: true,
    },
  });
  const latest = new Map<string, (typeof snapshots)[0]>();
  let newest: string | null = null;
  for (const s of snapshots) {
    if (!latest.has(s.machineId)) latest.set(s.machineId, s);
    const iso = s.generatedAt.toISOString();
    if (!newest || iso > newest) newest = iso;
  }

  const openDownCalls = recent.filter(
    (c) =>
      isOpenServiceCallStatus(c.status) &&
      (c.problem.machineCurrentlyDown ||
        c.priority === "CRITICAL" ||
        c.priority === "EMERGENCY"),
  ).length;

  let singleVisitClosed = 0;
  let closedMachines = 0;
  for (const [, v] of byMachine) {
    if (v.closed > 0 && v.open === 0) {
      closedMachines += 1;
      if (v.count === 1) singleVisitClosed += 1;
    }
  }
  const firstTimeFixRate =
    closedMachines === 0
      ? null
      : Math.round((singleVisitClosed / closedMachines) * 1000) / 10;

  const machines = [...byMachine.entries()]
    .map(([machineId, v]) => {
      const snap = latest.get(machineId);
      return {
        machineId,
        customerName: v.customerName,
        callCount90d: v.count,
        openCalls: v.open,
        healthScore: snap?.healthScore ?? null,
        riskLevel: snap?.riskLevel ?? null,
        repeatFlag: v.count >= 3,
        href: `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(machineId)}`,
      };
    })
    .sort(
      (a, b) =>
        Number(b.repeatFlag) - Number(a.repeatFlag) ||
        b.callCount90d - a.callCount90d,
    )
    .slice(0, 40);

  const meta = buildMeta({
    metric: "machine_reliability_90d",
    scope: "organization_machines",
    method: recent.length < 3 ? "insufficient_data" : "run_rate",
    methodLabel: "90-day service-call reliability rollup + health snapshots",
    horizon: "QUARTER",
    recordCount: recent.length,
    periodsWithData: byMachine.size > 0 ? 1 : 0,
    newestIso: newest ?? (recent[0]?.createdAt ?? null),
    assumptions: [
      "Repeat machine = ≥3 service calls in 90 days.",
      "First-time fix proxy = closed machines with exactly one call and no open calls.",
      "Health scores come from existing predictive maintenance snapshots (not re-scored here).",
    ],
    now,
  });

  return {
    meta,
    actual: {
      machinesWithCalls: byMachine.size,
      repeatCallMachines: machines.filter((m) => m.repeatFlag).length,
      openDownCalls,
      firstTimeFixRate,
    },
    machines,
  };
}
