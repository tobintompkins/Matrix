/**
 * Patch 51C.2 — Technician capacity forecast from roster + assignments.
 * Never auto-assigns technicians.
 */

import { listTechnicians } from "@/lib/service-dispatch";
import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import type { ForecastHorizon, ForecastMeta } from "./types";
import { buildMeta, horizonDays } from "./forecasting";
import { getServiceDemandForecast } from "./service-demand";

export type TechnicianCapacityForecast = {
  meta: ForecastMeta;
  actual: {
    technicians: number;
    availableHoursProxy: number;
    openAssignedHoursProxy: number;
  };
  forecast: {
    demandHours: number | null;
    capacityHours: number | null;
    gapHours: number | null;
  };
  byTechnician: Array<{
    name: string;
    status: string;
    openCalls: number;
    workloadHours: number;
    skills: string[];
    href: string;
  }>;
};

export function getTechnicianCapacityForecast(input?: {
  horizon?: ForecastHorizon;
  now?: Date;
}): TechnicianCapacityForecast {
  const horizon = input?.horizon ?? "MONTH";
  const now = input?.now ?? new Date();
  const days = horizonDays(horizon);
  const weekdays = Math.max(1, Math.round(days * (5 / 7)));
  const capacityPerTech = weekdays * 8;

  const technicians = listTechnicians();
  const calls = listServiceCalls({ includeDeleted: false });
  const open = calls.filter((c) => isOpenServiceCallStatus(c.status));

  const byTechnician = technicians.map((t) => {
    const assigned = open.filter(
      (c) =>
        c.assignment.technician?.trim().toLowerCase() === t.name.toLowerCase(),
    );
    return {
      name: t.name,
      status: t.status,
      openCalls: assigned.length,
      workloadHours: t.estimatedWorkloadHours ?? 0,
      skills: t.certifications ?? [],
      href: "/field",
    };
  });

  const availableHoursProxy = technicians.length * capacityPerTech;
  const openAssignedHoursProxy = byTechnician.reduce(
    (s, t) => s + Math.max(t.workloadHours, t.openCalls * 1.5),
    0,
  );

  const demand = getServiceDemandForecast({ horizon, now });
  const hoursPerJob = 2.5;
  const demandHours =
    demand.nextPeriodForecast == null
      ? null
      : Math.round(demand.nextPeriodForecast * hoursPerJob * 10) / 10;
  const capacityHours = availableHoursProxy;
  const gapHours =
    demandHours == null ? null : Math.round((demandHours - capacityHours) * 10) / 10;

  const meta = buildMeta({
    metric: "technician_capacity_hours",
    scope: "dispatch_roster",
    method:
      technicians.length === 0 ? "insufficient_data" : demand.meta.method,
    methodLabel:
      "Capacity = roster × weekday hours; demand hours = service-demand forecast × 2.5h/job",
    horizon,
    recordCount: technicians.length + open.length,
    periodsWithData:
      technicians.length > 0 ? (demand.meta.recordCount > 0 ? 2 : 1) : 0,
    newestIso: now.toISOString(),
    forecastValue: demandHours,
    assumptions: [
      `${capacityPerTech}h capacity per technician over ${days} days (weekday proxy).`,
      "2.5 labor hours assumed per forecasted service job.",
      "Does not auto-assign or change schedules — recommendations need confirmation.",
    ],
    warnings:
      technicians.length === 0
        ? ["No technician roster — capacity forecast withheld."]
        : [],
    now,
  });

  return {
    meta,
    actual: {
      technicians: technicians.length,
      availableHoursProxy,
      openAssignedHoursProxy: Math.round(openAssignedHoursProxy * 10) / 10,
    },
    forecast: {
      demandHours,
      capacityHours,
      gapHours,
    },
    byTechnician: byTechnician.sort((a, b) => b.openCalls - a.openCalls),
  };
}
