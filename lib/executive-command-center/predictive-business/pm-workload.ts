/**
 * Patch 51C.2 — PM workload forecast from MachinePmState + existing meter due logic.
 */

import { prisma } from "@/lib/db/prisma";
import type { ForecastHorizon, ForecastMeta } from "./types";
import { buildMeta, horizonDays } from "./forecasting";

export type PmWorkloadForecast = {
  meta: ForecastMeta;
  actual: {
    activeMachines: number;
    overdueNow: number;
    dueSoon: number;
  };
  forecast: {
    jobsInHorizon: number | null;
    overdueProjected: number | null;
  };
  rows: Array<{
    machineId: string;
    customerName: string | null;
    remaining: number | null;
    status: "OVERDUE" | "DUE_SOON" | "OK" | "UNKNOWN";
  }>;
};

export async function getPmWorkloadForecast(input?: {
  horizon?: ForecastHorizon;
  organizationId?: string;
  now?: Date;
}): Promise<PmWorkloadForecast> {
  const horizon = input?.horizon ?? "MONTH";
  const now = input?.now ?? new Date();
  const dueSoonThreshold = horizon === "WEEK" ? 5_000 : horizon === "MONTH" ? 10_000 : 25_000;

  const states = await prisma.machinePmState.findMany({
    where: { active: true },
    take: 800,
    select: {
      machineId: true,
      customerName: true,
      currentMeterCount: true,
      nextPmDueCount: true,
      updatedAt: true,
    },
  });

  let overdue = 0;
  let dueSoon = 0;
  let newest: string | null = null;
  const rows: PmWorkloadForecast["rows"] = [];

  for (const s of states) {
    if (s.updatedAt) {
      const iso = s.updatedAt.toISOString();
      if (!newest || iso > newest) newest = iso;
    }
    if (s.currentMeterCount == null || s.nextPmDueCount == null) {
      rows.push({
        machineId: s.machineId,
        customerName: s.customerName,
        remaining: null,
        status: "UNKNOWN",
      });
      continue;
    }
    const remaining = s.nextPmDueCount - s.currentMeterCount;
    let status: "OVERDUE" | "DUE_SOON" | "OK" = "OK";
    if (remaining <= 0) {
      status = "OVERDUE";
      overdue += 1;
    } else if (remaining <= dueSoonThreshold) {
      status = "DUE_SOON";
      dueSoon += 1;
    }
    rows.push({
      machineId: s.machineId,
      customerName: s.customerName,
      remaining,
      status,
    });
  }

  const jobsInHorizon = overdue + dueSoon;
  const method =
    states.length === 0
      ? ("insufficient_data" as const)
      : ("meter_rate" as const);

  const meta = buildMeta({
    metric: "pm_jobs_due",
    scope: "active_machine_pm_state",
    method,
    methodLabel:
      method === "meter_rate"
        ? "Meter-rate / meter-due projection (current vs nextPmDueCount)"
        : "Insufficient data",
    horizon,
    recordCount: states.length,
    periodsWithData: states.filter(
      (s) => s.currentMeterCount != null && s.nextPmDueCount != null,
    ).length,
    newestIso: newest,
    forecastValue: method === "insufficient_data" ? null : jobsInHorizon,
    assumptions: [
      `Due-soon threshold ≈ ${dueSoonThreshold.toLocaleString()} meter units for ${horizonDays(horizon)}-day horizon.`,
      "Uses existing MachinePmState meter fields — does not change PM schedules.",
      "Jobs in horizon = overdue now + due-soon by meter remaining (meter-rate projection).",
      "Recommendations require user confirmation before scheduling.",
    ],
    warnings:
      states.length === 0
        ? ["No active PM states — PM workload forecast withheld."]
        : [],
    now,
  });

  return {
    meta,
    actual: {
      activeMachines: states.length,
      overdueNow: overdue,
      dueSoon,
    },
    forecast: {
      jobsInHorizon: method === "insufficient_data" ? null : jobsInHorizon,
      overdueProjected: method === "insufficient_data" ? null : overdue,
    },
    rows: rows
      .filter((r) => r.status === "OVERDUE" || r.status === "DUE_SOON")
      .slice(0, 40),
  };
}
