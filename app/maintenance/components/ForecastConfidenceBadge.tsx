"use client";

import type { ForecastConfidence } from "@/lib/pm-intelligence";

export default function ForecastConfidenceBadge({
  confidence,
}: {
  confidence: ForecastConfidence;
}) {
  const color =
    confidence === "High Confidence"
      ? "bg-emerald-500/15 text-emerald-300"
      : confidence === "Moderate Confidence"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-slate-700/50 text-slate-400";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {confidence}
    </span>
  );
}
