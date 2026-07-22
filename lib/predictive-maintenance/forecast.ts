/**
 * Patch 51A.3 — Maintenance forecast (official PM due vs predicted window).
 */

import {
  averageDailyVolume,
  estimatePmDate,
} from "@/lib/pm-intelligence/calculations";
import type { CopyCountHistory } from "@/lib/maintenance";
import type {
  MachinePredictiveInput,
  MaintenanceForecastResult,
} from "./types";

function toCopyHistory(
  meters: MachinePredictiveInput["meterHistory"],
): CopyCountHistory[] {
  return meters.map((m, i) => ({
    id: `pred-meter-${i}`,
    printerId: "predictive",
    copyCount: m.meterCount,
    recordedAt: m.recordedAt,
    enteredBy: "system",
    notes: "",
    previousCount: m.previousCount ?? null,
    lowerCountReason: null,
  }));
}

export function calculateMaintenanceForecast(
  input: MachinePredictiveInput,
  opts: { pmDueSoonDays: number } = { pmDueSoonDays: 14 },
): MaintenanceForecastResult {
  const history = toCopyHistory(input.meterHistory);
  const avgDaily = averageDailyVolume(history, null);
  const current = input.currentMeterCount ?? null;
  const dueMeter = input.nextPmDueCount ?? (
    input.lastPmCount != null && input.pmInterval != null
      ? input.lastPmCount + input.pmInterval
      : null
  );

  let impressionsRemaining: number | null = null;
  if (current != null && dueMeter != null) {
    impressionsRemaining = dueMeter - current;
  }

  const estimated = estimatePmDate(impressionsRemaining, avgDaily);
  const predictedDueDate = estimated.date;

  let windowStart: string | null = null;
  let windowEnd: string | null = null;
  if (predictedDueDate) {
    const due = new Date(predictedDueDate);
    const start = new Date(due);
    start.setDate(start.getDate() - Math.max(3, Math.floor(opts.pmDueSoonDays / 3)));
    const end = new Date(due);
    end.setDate(end.getDate() + Math.max(3, Math.floor(opts.pmDueSoonDays / 3)));
    windowStart = start.toISOString().slice(0, 10);
    windowEnd = end.toISOString().slice(0, 10);
  }

  let daysRemaining: number | null = null;
  if (predictedDueDate) {
    daysRemaining = Math.ceil(
      (new Date(predictedDueDate).getTime() - Date.now()) / 86_400_000,
    );
  }

  const confidenceMap = {
    "High Confidence": 85,
    "Moderate Confidence": 60,
    "Low Confidence": 35,
  } as const;

  const confidenceScore = confidenceMap[estimated.confidence] ?? 35;
  const isOfficial =
    dueMeter != null &&
    input.pmInterval != null &&
    impressionsRemaining != null;

  const parts: string[] = [];
  if (dueMeter != null) parts.push(`Official PM due meter: ${dueMeter}.`);
  if (impressionsRemaining != null) {
    parts.push(`Impressions remaining: ${impressionsRemaining}.`);
  }
  if (avgDaily != null) parts.push(`Avg daily usage ≈ ${avgDaily}.`);
  if (predictedDueDate) {
    parts.push(`Predicted ideal service date: ${predictedDueDate} (${estimated.confidence}).`);
  } else {
    parts.push("Insufficient usage data to predict a calendar date.");
  }

  return {
    officialDueMeter: dueMeter,
    officialDueDate: null,
    predictedDueDate,
    windowStart,
    windowEnd,
    predictedMeterAtDue: dueMeter,
    daysRemaining,
    impressionsRemaining,
    confidenceScore,
    explanation: parts.join(" "),
    isOfficial,
  };
}
