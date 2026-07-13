"use client";

import { MatrixCard } from "@/app/components/ui";
import type { DashboardChartData } from "@/lib/maintenance";

type Props = {
  charts: DashboardChartData;
};

function BarChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <MatrixCard title={title} className="h-full">
      <div className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-slate-500">Insufficient data</p>
        ) : (
          data.map((d) => (
            <div key={d.label}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span className="truncate pr-2">{d.label}</span>
                <span>{d.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-cyan-500"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </MatrixCard>
  );
}

export default function MaintenanceChartsPanel({ charts }: Props) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <BarChart title="PM Completion Trend" data={charts.pmCompletionTrend} />
      <BarChart title="Fleet Growth" data={charts.fleetGrowth} />
      <BarChart title="Copy Count Trend" data={charts.copyCountTrend} />
      <BarChart title="Monthly Volume" data={charts.monthlyVolume} />
      <BarChart title="Maintenance Types" data={charts.maintenanceTypes} />
      <BarChart title="Status Distribution" data={charts.statusDistribution} />
      <BarChart title="Printer Models" data={charts.printerModels} />
      <BarChart title="Customer Distribution" data={charts.customerDistribution} />
    </div>
  );
}
