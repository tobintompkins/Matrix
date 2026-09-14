/**
 * Patch 51C.2 — Parts demand + stockout risk from inventory transactions/balances.
 * Never auto-orders parts.
 */

import {
  listBalances,
  listCatalog,
  listTransactions,
  usageByPart,
  isLowStock,
  isOutOfStock,
} from "@/lib/inventory";
import type { ForecastHorizon, ForecastMeta, SeriesPoint } from "./types";
import {
  buildMeta,
  horizonDays,
  periodKey,
  pickBaselineForecast,
} from "./forecasting";

export type PartsDemandForecast = {
  meta: ForecastMeta;
  series: SeriesPoint[];
  nextPeriodForecast: number | null;
  stockoutRisk: Array<{
    partNumber: string;
    description: string;
    onHand: number;
    recentUsage: number;
    daysOfCover: number | null;
    risk: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    href: string;
  }>;
  actualConsumedInLookback: number;
};

export function getPartsDemandForecast(input?: {
  horizon?: ForecastHorizon;
  now?: Date;
}): PartsDemandForecast {
  const horizon = input?.horizon ?? "MONTH";
  const now = input?.now ?? new Date();
  const lookbackDays = Math.max(horizonDays(horizon) * 4, 90);
  const startMs = now.getTime() - lookbackDays * 86_400_000;

  const txns = listTransactions(5_000).filter((t) => {
    if (t.type !== "CONSUME") return false;
    const tms = new Date(t.occurredAt).getTime();
    return Number.isFinite(tms) && tms >= startMs && tms <= now.getTime();
  });

  const byPeriod = new Map<string, number>();
  let newest: string | null = null;
  for (const t of txns) {
    if (!newest || t.occurredAt > newest) newest = t.occurredAt;
    const key = periodKey(new Date(t.occurredAt), horizon === "WEEK" ? "week" : "month");
    byPeriod.set(key, (byPeriod.get(key) ?? 0) + t.quantity);
  }
  const labels = [...byPeriod.keys()].sort();
  const values = labels.map((l) => byPeriod.get(l) ?? 0);
  const grain: "week" | "month" = horizon === "WEEK" ? "week" : "month";
  const picked = pickBaselineForecast(values, grain);
  // Prefer consumption_rate label when we have a usable baseline from usage.
  if (picked.method !== "insufficient_data") {
    picked.method = "consumption_rate";
    picked.methodLabel = `${picked.methodLabel} + consumption-rate stockout cover`;
  }

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

  const usage = usageByPart(txns);
  const catalog = listCatalog("", 1, 5000).items;
  const desc = new Map(catalog.map((p) => [p.partNumber.toLowerCase(), p.description]));
  const balances = listBalances();
  const onHandByPn = new Map<string, number>();
  for (const b of balances) {
    const part = catalog.find((p) => p.id === b.partId);
    if (!part) continue;
    onHandByPn.set(
      part.partNumber.toLowerCase(),
      (onHandByPn.get(part.partNumber.toLowerCase()) ?? 0) + b.quantityOnHand,
    );
  }

  const dailyHorizon = horizonDays(horizon);
  const stockoutRisk = [...usage.entries()]
    .map(([partNumber, recentUsage]) => {
      const onHand = onHandByPn.get(partNumber.toLowerCase()) ?? 0;
      const daily = recentUsage / Math.max(1, lookbackDays);
      const daysOfCover =
        daily > 0 ? Math.round((onHand / daily) * 10) / 10 : null;
      let risk: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" = "UNKNOWN";
      if (daysOfCover == null) risk = onHand <= 0 ? "HIGH" : "LOW";
      else if (daysOfCover < dailyHorizon * 0.5) risk = "HIGH";
      else if (daysOfCover < dailyHorizon) risk = "MEDIUM";
      else risk = "LOW";
      const bal = balances.find((b) => {
        const part = catalog.find((p) => p.id === b.partId);
        return part?.partNumber.toLowerCase() === partNumber.toLowerCase();
      });
      if (bal && (isOutOfStock(bal) || isLowStock(bal))) {
        risk = isOutOfStock(bal) ? "HIGH" : risk === "LOW" ? "MEDIUM" : risk;
      }
      return {
        partNumber,
        description:
          desc.get(partNumber.toLowerCase()) ?? "Catalog description unavailable",
        onHand,
        recentUsage,
        daysOfCover,
        risk,
        href: `/inventory?q=${encodeURIComponent(partNumber)}`,
      };
    })
    .sort((a, b) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2, UNKNOWN: 3 };
      return rank[a.risk] - rank[b.risk] || b.recentUsage - a.recentUsage;
    })
    .slice(0, 20);

  const meta = buildMeta({
    metric: "parts_units_consumed",
    scope: "organization_inventory",
    method: picked.method,
    methodLabel: picked.methodLabel,
    horizon,
    recordCount: txns.length,
    periodsWithData: values.filter((v) => v > 0).length,
    newestIso: newest,
    forecastValue: picked.value,
    forecastLow: picked.low,
    forecastHigh: picked.high,
    assumptions: [
      "Demand uses CONSUME inventory transactions only.",
      "Stockout risk = on-hand ÷ recent daily usage vs horizon length (consumption-rate projection).",
      "Never creates purchase orders or stock moves — recommendations need user confirmation.",
    ],
    warnings:
      txns.length < 3
        ? ["Few CONSUME transactions — parts demand forecast may be unreliable."]
        : [],
    now,
  });

  return {
    meta,
    series,
    nextPeriodForecast: picked.value,
    stockoutRisk,
    actualConsumedInLookback: txns.reduce((s, t) => s + t.quantity, 0),
  };
}
