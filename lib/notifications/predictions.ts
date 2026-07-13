/**
 * Predictive maintenance estimates from historical averages (Patch 36).
 * No AI services — volume + history only.
 */

import {
  buildMaintenanceTypeSnapshot,
} from "@/lib/maintenance/calculations";
import { getDefaultIntervalForModel } from "@/lib/maintenance/intervals";
import type {
  CopyCountHistory,
  MaintenanceIntervalConfig,
  MaintenanceKind,
  PrinterMaintenanceProfile,
} from "@/lib/maintenance/types";
import type {
  MaintenancePrediction,
  PredictionConfidence,
} from "./types";

const KIND_LABELS: Record<MaintenanceKind, string> = {
  PM: "Estimated Next PM",
  CLEANING: "Estimated Cleaning",
  JOINT_UNIT: "Estimated Joint Unit",
  DTF_PM: "Estimated DTF PM",
};

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Estimate monthly volume from history when profile.monthlyVolume is weak.
 */
export function estimateMonthlyVolumeFromHistory(
  history: CopyCountHistory[],
  fallbackMonthly: number | null,
): { volume: number | null; sampleDays: number } {
  const sorted = [...history].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt),
  );
  if (sorted.length < 2) {
    return { volume: fallbackMonthly, sampleDays: 0 };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days =
    (new Date(last.recordedAt).getTime() -
      new Date(first.recordedAt).getTime()) /
    (24 * 3600 * 1000);
  if (days < 7) {
    return { volume: fallbackMonthly, sampleDays: Math.max(0, days) };
  }
  const delta = last.copyCount - first.copyCount;
  if (delta < 0) {
    return { volume: fallbackMonthly, sampleDays: days };
  }
  const daily = delta / days;
  return { volume: Math.round(daily * 30), sampleDays: days };
}

export function predictionConfidence(input: {
  hasNextDue: boolean;
  monthlyVolume: number | null;
  historyPoints: number;
  sampleDays: number;
}): PredictionConfidence {
  if (!input.hasNextDue || !input.monthlyVolume || input.monthlyVolume <= 0) {
    return "Low";
  }
  if (input.historyPoints >= 3 && input.sampleDays >= 45) return "High";
  if (input.historyPoints >= 2 || input.sampleDays >= 20) return "Medium";
  if (input.monthlyVolume > 0) return "Medium";
  return "Low";
}

export function estimateMaintenanceDueDate(
  profile: PrinterMaintenanceProfile,
  kind: MaintenanceKind,
  monthlyVolume: number | null,
  now: Date = new Date(),
  intervals?: MaintenanceIntervalConfig,
): { date: string | null; days: number | null; remaining: number | null } {
  const config = intervals ?? getDefaultIntervalForModel(profile.printerModel);
  const snap = buildMaintenanceTypeSnapshot(profile, kind, config);
  if (
    snap.nextDueCount === null ||
    profile.currentCopyCount === null ||
    !monthlyVolume ||
    monthlyVolume <= 0
  ) {
    return { date: null, days: null, remaining: snap.copiesRemaining };
  }
  const remaining = snap.nextDueCount - profile.currentCopyCount;
  if (remaining <= 0) {
    return { date: now.toISOString().slice(0, 10), days: 0, remaining: 0 };
  }
  const months = remaining / monthlyVolume;
  const days = Math.max(0, Math.round(months * 30));
  return {
    date: addDays(now, days).toISOString().slice(0, 10),
    days,
    remaining,
  };
}

export function buildMaintenancePredictions(
  profile: PrinterMaintenanceProfile,
  history: CopyCountHistory[] = [],
  now: Date = new Date(),
  intervals?: MaintenanceIntervalConfig,
): MaintenancePrediction[] {
  const { volume, sampleDays } = estimateMonthlyVolumeFromHistory(
    history,
    profile.monthlyVolume,
  );
  const kinds: MaintenanceKind[] = ["PM", "CLEANING", "JOINT_UNIT", "DTF_PM"];

  return kinds.map((kind) => {
    const est = estimateMaintenanceDueDate(
      profile,
      kind,
      volume,
      now,
      intervals,
    );
    const confidence = predictionConfidence({
      hasNextDue: est.date !== null,
      monthlyVolume: volume,
      historyPoints: history.length,
      sampleDays,
    });
    const explanation =
      est.date === null
        ? "Insufficient baseline or volume data for a date estimate."
        : `Based on ${volume?.toLocaleString("en-US") ?? "—"} copies/month average${
            sampleDays > 0 ? ` from ${Math.round(sampleDays)} days of history` : ""
          }. Confidence: ${confidence}.`;

    return {
      kind,
      label: KIND_LABELS[kind],
      estimatedDate: est.date,
      estimatedDays: est.days,
      copiesRemaining: est.remaining,
      confidence,
      explanation,
    };
  });
}
