/**
 * Patch 51C.2 — Scenario planner. Never mutates live / production records.
 */

import type { ScenarioAssumptions, ScenarioResult } from "./types";
import { getServiceDemandForecast } from "./service-demand";
import { getPmWorkloadForecast } from "./pm-workload";
import { getPartsDemandForecast } from "./parts-demand";
import { getTechnicianCapacityForecast } from "./technician-capacity";

function applyDelta(base: number | null, deltaPct: number): number {
  if (base == null) return 0;
  return Math.round(base * (1 + deltaPct / 100) * 10) / 10;
}

export async function runScenarioPlanner(input?: {
  assumptions?: Partial<ScenarioAssumptions>;
  label?: string;
}): Promise<ScenarioResult> {
  const assumptions: ScenarioAssumptions = {
    serviceDemandDeltaPct: input?.assumptions?.serviceDemandDeltaPct ?? 0,
    pmWorkloadDeltaPct: input?.assumptions?.pmWorkloadDeltaPct ?? 0,
    partsDemandDeltaPct: input?.assumptions?.partsDemandDeltaPct ?? 0,
    technicianCapacityDeltaPct:
      input?.assumptions?.technicianCapacityDeltaPct ?? 0,
    label: input?.label,
  };

  const [service, pm, parts, tech] = await Promise.all([
    Promise.resolve(getServiceDemandForecast({ horizon: "MONTH" })),
    getPmWorkloadForecast({ horizon: "MONTH" }),
    Promise.resolve(getPartsDemandForecast({ horizon: "MONTH" })),
    Promise.resolve(getTechnicianCapacityForecast({ horizon: "MONTH" })),
  ]);

  const serviceDemand = applyDelta(
    service.nextPeriodForecast,
    assumptions.serviceDemandDeltaPct,
  );
  const pmJobs = applyDelta(
    pm.forecast.jobsInHorizon,
    assumptions.pmWorkloadDeltaPct,
  );
  const partsUnits = applyDelta(
    parts.nextPeriodForecast,
    assumptions.partsDemandDeltaPct,
  );
  const techHoursNeeded = applyDelta(
    tech.forecast.demandHours,
    assumptions.serviceDemandDeltaPct,
  );
  const techHoursAvailable = applyDelta(
    tech.forecast.capacityHours,
    assumptions.technicianCapacityDeltaPct,
  );

  const warnings: string[] = [
    "Scenario output is what-if only — no PM schedules, parts orders, or assignments were changed.",
  ];
  if (service.nextPeriodForecast == null) {
    warnings.push("Service demand baseline insufficient — scenario uses 0.");
  }

  return {
    id: `scenario-${Date.now()}`,
    label: assumptions.label?.trim() || "What-if scenario",
    assumptions,
    projected: {
      serviceDemand,
      pmJobs,
      partsUnits,
      techHoursNeeded,
      techHoursAvailable,
      capacityGapHours:
        Math.round((techHoursNeeded - techHoursAvailable) * 10) / 10,
    },
    warnings,
    mutatesLiveRecords: false,
    requiresUserConfirmation: true,
  };
}
