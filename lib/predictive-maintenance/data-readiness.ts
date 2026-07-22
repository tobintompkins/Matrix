/**
 * Patch 51A.3 — Data readiness for predictive evaluation.
 */

import type { MachineDataReadiness, MachinePredictiveInput } from "./types";

function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / 86_400_000);
}

export function assessMachineDataReadiness(
  input: MachinePredictiveInput,
  opts: { staleMeterDays: number } = { staleMeterDays: 45 },
): MachineDataReadiness {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const usableSignals: string[] = [];
  const excludedSignals: string[] = [];
  let score = 100;

  if (!input.active) {
    warnings.push("Machine is inactive.");
    score -= 20;
  } else {
    usableSignals.push("active_status");
  }

  if (!input.printerModel) {
    missingFields.push("printerModel");
    score -= 15;
    excludedSignals.push("model_specific_interval");
  } else {
    usableSignals.push("printerModel");
  }

  if (!input.installDate) {
    missingFields.push("installDate");
    score -= 5;
    excludedSignals.push("machine_age");
  } else {
    usableSignals.push("installDate");
  }

  if (input.currentMeterCount == null) {
    missingFields.push("currentMeterCount");
    score -= 20;
    excludedSignals.push("meter_distance_to_pm");
  } else {
    usableSignals.push("currentMeterCount");
  }

  if (!input.meterHistory.length) {
    missingFields.push("meterHistory");
    score -= 15;
    excludedSignals.push("usage_trend");
  } else {
    usableSignals.push("meterHistory");
    const last = input.meterHistory[input.meterHistory.length - 1];
    const age = daysSince(last.recordedAt);
    if (age != null && age > opts.staleMeterDays) {
      warnings.push(`Latest meter reading is ${age} days old.`);
      score -= 10;
    }
    // Impossible / decreasing meters without reason
    for (let i = 1; i < input.meterHistory.length; i++) {
      const prev = input.meterHistory[i - 1];
      const cur = input.meterHistory[i];
      if (cur.meterCount < prev.meterCount) {
        warnings.push("Meter decreased vs prior reading (possible reset/rollover).");
        score -= 8;
        break;
      }
    }
  }

  if (input.pmInterval == null || input.pmInterval <= 0) {
    missingFields.push("pmInterval");
    score -= 15;
    excludedSignals.push("official_pm_threshold");
  } else {
    usableSignals.push("pmInterval");
  }

  if (!input.lastPmAt && input.lastPmCount == null) {
    missingFields.push("pmHistory");
    score -= 8;
    excludedSignals.push("pm_compliance");
  } else {
    usableSignals.push("pmHistory");
  }

  if (input.serviceCalls.length) {
    usableSignals.push("serviceCallHistory");
  } else {
    warnings.push("No service-call history available for this machine.");
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));
  const ready = score >= 40 && Boolean(input.printerModel || input.currentMeterCount != null);

  return {
    ready,
    score,
    missingFields: [...new Set(missingFields)],
    warnings: [...new Set(warnings)],
    usableSignals: [...new Set(usableSignals)],
    excludedSignals: [...new Set(excludedSignals)],
  };
}
