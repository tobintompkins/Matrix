"use client";

import { useMemo } from "react";
import { MatrixCard, MatrixStatusBadge } from "@/app/components/ui";
import {
  getPrinterHealth,
  getPrinterPredictions,
  getPrinterRecommendations,
} from "@/lib/notifications";

type Props = {
  printerId: string;
};

export default function PrinterIntelligencePanel({ printerId }: Props) {
  const health = useMemo(() => getPrinterHealth(printerId), [printerId]);
  const predictions = useMemo(
    () => getPrinterPredictions(printerId),
    [printerId],
  );
  const recommendations = useMemo(
    () => getPrinterRecommendations(printerId),
    [printerId],
  );

  if (!health) {
    return (
      <MatrixCard title="Printer Intelligence">
        <p className="text-sm text-slate-500">No maintenance profile found.</p>
      </MatrixCard>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <MatrixCard title="Printer Health Indicators" subtitle={health.band}>
        <p className="text-4xl font-bold text-cyan-400">
          {health.overallHealthScore}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Maintenance Compliance</dt>
            <dd>{health.maintenanceCompliance}%</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Service History Score</dt>
            <dd>{health.serviceHistoryScore}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Open Issues</dt>
            <dd>{health.openIssues}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Recent Repairs</dt>
            <dd>{health.recentRepairs}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-400">Copy Volume Trend</dt>
            <dd>{health.copyVolumeTrend}</dd>
          </div>
        </dl>
      </MatrixCard>

      <MatrixCard
        title="Predictive Maintenance"
        subtitle="Historical averages only — no AI services"
      >
        <ul className="space-y-3 text-sm">
          {predictions.map((p) => (
            <li
              key={p.kind}
              className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white">{p.label}</p>
                <MatrixStatusBadge
                  variant={
                    p.confidence === "High"
                      ? "completed"
                      : p.confidence === "Medium"
                        ? "warning"
                        : "offline"
                  }
                  label={p.confidence}
                />
              </div>
              <p className="mt-1 text-cyan-300">
                {p.estimatedDate ?? "Insufficient data"}
                {p.estimatedDays !== null ? ` · ${p.estimatedDays}d` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">{p.explanation}</p>
            </li>
          ))}
        </ul>
      </MatrixCard>

      <MatrixCard
        title="Maintenance Recommendations"
        subtitle="Based on intervals and current status"
      >
        <ul className="space-y-3 text-sm">
          {recommendations.map((r) => (
            <li
              key={r.kind}
              className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white">{r.label}</p>
                <MatrixStatusBadge
                  variant={r.recommended ? "warning" : "completed"}
                  label={r.recommended ? "Recommended" : "OK"}
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">{r.explanation}</p>
            </li>
          ))}
        </ul>
      </MatrixCard>
    </div>
  );
}
