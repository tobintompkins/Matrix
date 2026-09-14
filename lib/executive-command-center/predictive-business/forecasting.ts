/**
 * Patch 51C.2 — Explainable baseline forecasting helpers.
 * Preferred methods per 02_IMPLEMENTATION_SPEC.
 */

import type { ForecastHorizon, ForecastMethodId, ForecastMeta } from "./types";
import { FORECAST_METHOD_VERSION } from "./types";

export function horizonDays(horizon: ForecastHorizon): number {
  if (horizon === "WEEK") return 7;
  if (horizon === "MONTH") return 30;
  return 90;
}

export function horizonLabel(horizon: ForecastHorizon): string {
  if (horizon === "WEEK") return "Next 7 days";
  if (horizon === "MONTH") return "Next 30 days";
  return "Next 90 days";
}

export function periodKey(d: Date, grain: "week" | "month"): string {
  if (grain === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const day = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${day.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function movingAverage(values: number[], window = 4): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return null;
  const slice = clean.slice(-Math.max(1, window));
  const sum = slice.reduce((a, b) => a + b, 0);
  return Math.round((sum / slice.length) * 10) / 10;
}

/** Linear weights: oldest=1 … newest=n within the window. */
export function weightedMovingAverage(
  values: number[],
  window = 4,
): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return null;
  const slice = clean.slice(-Math.max(1, window));
  let num = 0;
  let den = 0;
  for (let i = 0; i < slice.length; i++) {
    const w = i + 1;
    num += slice[i] * w;
    den += w;
  }
  if (den === 0) return null;
  return Math.round((num / den) * 10) / 10;
}

export function linearTrendNext(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 3) return null;
  const n = clean.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += clean[i];
    sumXY += i * clean[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return movingAverage(clean, 3);
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const next = intercept + slope * n;
  return Math.max(0, Math.round(next * 10) / 10);
}

/**
 * Seasonal comparison: same-index period from prior cycle when ≥12 points.
 * For monthly series, compares to value 12 ago; for weekly, 4 ago.
 */
export function seasonalComparisonNext(
  values: number[],
  seasonLength: number,
): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < seasonLength * 2) return null;
  const prior = clean[clean.length - seasonLength];
  const recentMa = movingAverage(clean, Math.min(3, clean.length));
  if (prior == null || recentMa == null) return null;
  // Blend prior season with recent level (50/50) — explainable, conservative.
  return Math.round(((prior + recentMa) / 2) * 10) / 10;
}

export function sampleStdDev(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 4) return null;
  const mean = clean.reduce((a, b) => a + b, 0) / clean.length;
  const varSum = clean.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(varSum / (clean.length - 1));
}

export function pickBaselineForecast(
  values: number[],
  grain: "week" | "month" = "month",
): {
  value: number | null;
  method: ForecastMethodId;
  methodLabel: string;
  low: number | null;
  high: number | null;
} {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return {
      value: null,
      method: "insufficient_data",
      methodLabel: "Insufficient history",
      low: null,
      high: null,
    };
  }

  const seasonLen = grain === "week" ? 4 : 12;
  let value: number | null = null;
  let method: ForecastMethodId = "moving_average";
  let methodLabel = "";

  const seasonal = seasonalComparisonNext(clean, seasonLen);
  if (seasonal != null) {
    value = seasonal;
    method = "seasonal_comparison";
    methodLabel = `Seasonal comparison (period-${seasonLen} blend)`;
  } else if (clean.length >= 6) {
    const trend = linearTrendNext(clean);
    if (trend != null) {
      value = trend;
      method = "linear_trend";
      methodLabel = "Linear trend (OLS, one-step)";
    }
  }

  if (value == null && clean.length >= 4) {
    value = weightedMovingAverage(clean, Math.min(4, clean.length));
    method = "weighted_moving_average";
    methodLabel = `Weighted moving average (last ${Math.min(4, clean.length)})`;
  }

  if (value == null) {
    value = movingAverage(clean, Math.min(4, clean.length));
    method = "moving_average";
    methodLabel = `Moving average (last ${Math.min(4, clean.length)} periods)`;
  }

  const sd = sampleStdDev(clean);
  let low: number | null = null;
  let high: number | null = null;
  if (value != null && sd != null && clean.length >= 4) {
    low = Math.max(0, Math.round((value - 1.28 * sd) * 10) / 10);
    high = Math.round((value + 1.28 * sd) * 10) / 10;
  }

  return { value, method, methodLabel, low, high };
}

export function confidenceFromHistory(
  recordCount: number,
  periodsWithData: number,
  minPeriods = 4,
): { confidence: number | null; note: string; sufficient: boolean } {
  if (periodsWithData < 2 || recordCount < 3) {
    return {
      confidence: null,
      note: "Confidence withheld — fewer than 2 historical periods with data.",
      sufficient: false,
    };
  }
  const coverage = Math.min(1, periodsWithData / minPeriods);
  const volume = Math.min(1, recordCount / 40);
  const score = Math.round((0.55 * coverage + 0.45 * volume) * 100);
  return {
    confidence: score,
    note:
      score >= 70
        ? "Supportable from available history volume and period coverage."
        : "Moderate/low confidence — expand history before relying on the forecast.",
    sufficient: periodsWithData >= minPeriods && recordCount >= 8,
  };
}

export function classifyFreshness(
  newestIso: string | null,
  now = new Date(),
): ForecastMeta["dataFreshness"] {
  if (!newestIso) return "unknown";
  const ageMs = now.getTime() - new Date(newestIso).getTime();
  if (!Number.isFinite(ageMs)) return "unknown";
  if (ageMs <= 7 * 86_400_000) return "fresh";
  return "stale";
}

export function buildMeta(input: {
  metric: string;
  scope: string;
  method: ForecastMethodId;
  methodLabel: string;
  horizon: ForecastHorizon;
  recordCount: number;
  periodsWithData: number;
  newestIso: string | null;
  assumptions: string[];
  warnings?: string[];
  forecastValue?: number | null;
  forecastLow?: number | null;
  forecastHigh?: number | null;
  now?: Date;
}): ForecastMeta {
  const now = input.now ?? new Date();
  const conf = confidenceFromHistory(input.recordCount, input.periodsWithData);
  const warnings = [...(input.warnings ?? [])];
  if (input.method === "insufficient_data") {
    warnings.push("Forecast withheld until more historical records are available.");
  }

  const boundsSupportable =
    conf.sufficient &&
    conf.confidence != null &&
    conf.confidence >= 55 &&
    input.forecastLow != null &&
    input.forecastHigh != null;

  return {
    metric: input.metric,
    scope: input.scope,
    method: input.method,
    methodLabel: input.methodLabel,
    methodVersion: FORECAST_METHOD_VERSION,
    horizon: input.horizon,
    horizonLabel: horizonLabel(input.horizon),
    generatedAt: now.toISOString(),
    sourceDataCutoff: input.newestIso,
    recordCount: input.recordCount,
    dataSufficient: conf.sufficient,
    confidence: conf.confidence,
    confidenceLow: boundsSupportable ? input.forecastLow! : null,
    confidenceHigh: boundsSupportable ? input.forecastHigh! : null,
    confidenceNote: boundsSupportable
      ? `${conf.note} Bounds ≈ ±1.28σ when supportable.`
      : conf.note,
    dataFreshness: classifyFreshness(input.newestIso, now),
    lastRefreshAt: now.toISOString(),
    assumptions: input.assumptions,
    warnings,
  };
}
