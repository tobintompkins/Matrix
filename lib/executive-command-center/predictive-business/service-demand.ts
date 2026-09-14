/**
 * Patch 51C.2 — Service demand forecast from existing service-call records.
 */

import { listServiceCalls } from "@/lib/service-calls";
import type { DimensionBreakdown, ForecastHorizon, ForecastMeta, SeriesPoint } from "./types";
import {
  buildMeta,
  horizonDays,
  periodKey,
  pickBaselineForecast,
} from "./forecasting";

export type ServiceDemandForecast = {
  meta: ForecastMeta;
  series: SeriesPoint[];
  nextPeriodForecast: number | null;
  byModel: DimensionBreakdown[];
  byCustomer: DimensionBreakdown[];
  byJobType: DimensionBreakdown[];
  byIssueCategory: DimensionBreakdown[];
  actualInHorizonWindow: number;
};

function bucketCounts(
  dates: string[],
  grain: "week" | "month",
): { labels: string[]; values: number[]; newest: string | null } {
  const map = new Map<string, number>();
  let newest: string | null = null;
  for (const iso of dates) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) continue;
    if (!newest || iso > newest) newest = iso;
    const key = periodKey(d, grain);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const labels = [...map.keys()].sort();
  return { labels, values: labels.map((l) => map.get(l) ?? 0), newest };
}

function topBreakdown(
  rows: Array<{ key: string; label: string }>,
  forecastTotal: number | null,
  limit = 8,
): DimensionBreakdown[] {
  const counts = new Map<string, { label: string; actual: number }>();
  for (const r of rows) {
    const cur = counts.get(r.key) ?? { label: r.label, actual: 0 };
    cur.actual += 1;
    counts.set(r.key, cur);
  }
  const sorted = [...counts.entries()]
    .map(([key, v]) => ({ key, label: v.label, actual: v.actual }))
    .sort((a, b) => b.actual - a.actual)
    .slice(0, limit);
  const sum = sorted.reduce((s, r) => s + r.actual, 0) || 1;
  return sorted.map((r) => ({
    key: r.key,
    label: r.label,
    actual: r.actual,
    forecast:
      forecastTotal == null
        ? 0
        : Math.round(((r.actual / sum) * forecastTotal) * 10) / 10,
  }));
}

export function getServiceDemandForecast(input?: {
  horizon?: ForecastHorizon;
  now?: Date;
}): ServiceDemandForecast {
  const horizon = input?.horizon ?? "MONTH";
  const now = input?.now ?? new Date();
  const grain: "week" | "month" = horizon === "WEEK" ? "week" : "month";
  const lookbackMs = Math.max(horizonDays(horizon) * 6, 180) * 86_400_000;
  const startMs = now.getTime() - lookbackMs;

  const calls = listServiceCalls({ includeDeleted: false }).filter((c) => {
    const t = new Date(c.createdAt).getTime();
    return Number.isFinite(t) && t >= startMs && t <= now.getTime();
  });

  const { labels, values, newest } = bucketCounts(
    calls.map((c) => c.createdAt),
    grain,
  );
  const picked = pickBaselineForecast(values, grain);

  const series: SeriesPoint[] = labels.map((period, i) => ({
    period,
    actual: values[i] ?? 0,
    forecast: null,
  }));
  if (picked.value != null) {
    series.push({
      period: `forecast:${horizon.toLowerCase()}`,
      actual: null,
      forecast: picked.value,
      forecastLow: picked.low,
      forecastHigh: picked.high,
    });
  }

  const windowStart = now.getTime() - horizonDays(horizon) * 86_400_000;
  const actualInHorizonWindow = calls.filter(
    (c) => new Date(c.createdAt).getTime() >= windowStart,
  ).length;

  const meta = buildMeta({
    metric: "service_call_volume",
    scope: "organization",
    method: picked.method,
    methodLabel: picked.methodLabel,
    horizon,
    recordCount: calls.length,
    periodsWithData: values.filter((v) => v > 0).length,
    newestIso: newest,
    forecastValue: picked.value,
    forecastLow: picked.low,
    forecastHigh: picked.high,
    assumptions: [
      "Demand counted from service-call createdAt timestamps.",
      "Dimension forecasts allocate the baseline total by historical share.",
      "Deleted calls are excluded; archived open history may still appear.",
    ],
    warnings:
      calls.length < 5
        ? ["Very few service calls in lookback — treat forecasts as directional only."]
        : [],
    now,
  });

  return {
    meta,
    series,
    nextPeriodForecast: picked.value,
    byModel: topBreakdown(
      calls.map((c) => ({
        key: (c.machine.printerModel || "unknown").toLowerCase(),
        label: c.machine.printerModel || "Unknown model",
      })),
      picked.value,
    ),
    byCustomer: topBreakdown(
      calls.map((c) => ({
        key: (c.machine.customerName || "unknown").toLowerCase(),
        label: c.machine.customerName || "Unknown customer",
      })),
      picked.value,
    ),
    byJobType: topBreakdown(
      calls.map((c) => ({
        key: String(c.serviceType || "SERVICE").toUpperCase(),
        label: String(c.serviceType || "SERVICE"),
      })),
      picked.value,
    ),
    byIssueCategory: topBreakdown(
      calls.map((c) => {
        const label =
          c.problem.errorCode?.trim() ||
          c.problem.issueTitle?.trim() ||
          "General";
        return {
          key: label.toLowerCase().slice(0, 48),
          label,
        };
      }),
      picked.value,
    ),
    actualInHorizonWindow,
  };
}
