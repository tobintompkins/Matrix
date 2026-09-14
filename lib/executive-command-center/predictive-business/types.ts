/**
 * Patch 51C.2 — Shared types for Predictive Business Analytics.
 * Actuals and forecasts are always separate fields.
 * Aligns with official 02_IMPLEMENTATION_SPEC forecast-result fields.
 */

export type ForecastHorizon = "WEEK" | "MONTH" | "QUARTER";

export type ForecastMethodId =
  | "moving_average"
  | "weighted_moving_average"
  | "linear_trend"
  | "seasonal_comparison"
  | "meter_rate"
  | "consumption_rate"
  | "run_rate"
  | "insufficient_data";

/** Spec: method + version string for explainability. */
export const FORECAST_METHOD_VERSION = "pba-baseline-v1";

export type ForecastMeta = {
  metric: string;
  scope: string;
  method: ForecastMethodId;
  methodLabel: string;
  methodVersion: string;
  horizon: ForecastHorizon;
  horizonLabel: string;
  generatedAt: string;
  sourceDataCutoff: string | null;
  recordCount: number;
  dataSufficient: boolean;
  confidence: number | null;
  /** Only populated when supportable (≥4 periods + sufficient volume). */
  confidenceLow: number | null;
  confidenceHigh: number | null;
  confidenceNote: string;
  dataFreshness: "fresh" | "stale" | "unknown";
  lastRefreshAt: string;
  assumptions: string[];
  warnings: string[];
};

export type SeriesPoint = {
  period: string;
  actual: number | null;
  forecast: number | null;
  forecastLow?: number | null;
  forecastHigh?: number | null;
};

export type DimensionBreakdown = {
  key: string;
  label: string;
  actual: number;
  forecast: number;
};

export type DataQualitySource = {
  source: string;
  recordCount: number;
  staleOrMissing: number;
  sufficient: boolean;
  note: string;
};

export type DataQualityPanel = {
  lastRefreshAt: string;
  overallSufficient: boolean;
  sources: DataQualitySource[];
  warnings: string[];
};

export type ScenarioAssumptions = {
  serviceDemandDeltaPct: number;
  pmWorkloadDeltaPct: number;
  partsDemandDeltaPct: number;
  technicianCapacityDeltaPct: number;
  label?: string;
};

export type ScenarioResult = {
  id: string;
  label: string;
  assumptions: ScenarioAssumptions;
  projected: {
    serviceDemand: number;
    pmJobs: number;
    partsUnits: number;
    techHoursNeeded: number;
    techHoursAvailable: number;
    capacityGapHours: number;
  };
  warnings: string[];
  mutatesLiveRecords: false;
  requiresUserConfirmation: true;
};
