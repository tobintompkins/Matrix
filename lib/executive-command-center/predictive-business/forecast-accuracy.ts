/**
 * Patch 51C.2 — Forecast-versus-actual accuracy (baseline vs recent window).
 */

import type { ForecastMeta } from "./types";
import { buildMeta } from "./forecasting";
import { getServiceDemandForecast } from "./service-demand";
import { getPartsDemandForecast } from "./parts-demand";

export type AccuracyRow = {
  domain: string;
  method: string;
  actual: number;
  forecast: number | null;
  absoluteError: number | null;
  percentError: number | null;
  note: string;
};

export type ForecastAccuracyDashboard = {
  meta: ForecastMeta;
  rows: AccuracyRow[];
};

function pctError(actual: number, forecast: number | null): {
  absoluteError: number | null;
  percentError: number | null;
} {
  if (forecast == null) return { absoluteError: null, percentError: null };
  const abs = Math.round(Math.abs(actual - forecast) * 10) / 10;
  const pct =
    actual === 0
      ? forecast === 0
        ? 0
        : null
      : Math.round((abs / Math.abs(actual)) * 1000) / 10;
  return { absoluteError: abs, percentError: pct };
}

export function getForecastAccuracyDashboard(input?: {
  now?: Date;
}): ForecastAccuracyDashboard {
  const now = input?.now ?? new Date();
  const service = getServiceDemandForecast({ horizon: "MONTH", now });
  const parts = getPartsDemandForecast({ horizon: "MONTH", now });

  const serviceErr = pctError(
    service.actualInHorizonWindow,
    service.nextPeriodForecast,
  );
  const partsErr = pctError(
    parts.actualConsumedInLookback /
      Math.max(1, parts.series.filter((s) => s.actual != null).length || 1),
    parts.nextPeriodForecast,
  );

  const rows: AccuracyRow[] = [
    {
      domain: "Service demand",
      method: service.meta.methodLabel,
      actual: service.actualInHorizonWindow,
      forecast: service.nextPeriodForecast,
      ...serviceErr,
      note: "Compares last-horizon actual call volume to next-period baseline forecast (directional).",
    },
    {
      domain: "Parts consumption",
      method: parts.meta.methodLabel,
      actual: parts.actualConsumedInLookback,
      forecast: parts.nextPeriodForecast,
      absoluteError:
        parts.nextPeriodForecast == null
          ? null
          : Math.round(
              Math.abs(parts.actualConsumedInLookback - parts.nextPeriodForecast) *
                10,
            ) / 10,
      percentError: partsErr.percentError,
      note: "Lookback consumption vs next-period forecast — not a stored backtest archive.",
    },
  ];

  const meta = buildMeta({
    metric: "forecast_vs_actual",
    scope: "organization",
    method: "run_rate",
    methodLabel: "Inline forecast-vs-recent-actual comparison",
    horizon: "MONTH",
    recordCount: rows.length,
    periodsWithData: rows.filter((r) => r.forecast != null).length,
    newestIso: now.toISOString(),
    assumptions: [
      "No persisted forecast snapshots yet — accuracy is computed live from baselines.",
      "Absolute/percent error withheld when forecast is null.",
    ],
    now,
  });

  return { meta, rows };
}
