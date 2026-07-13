"use client";

import { MatrixCard, MatrixStatCard } from "@/app/components/ui";
import {
  formatCopyCount,
  formatMaintenanceDate,
  type CustomerMaintenanceSummaryData,
} from "@/lib/maintenance";

type Props = {
  summary: CustomerMaintenanceSummaryData;
};

export default function CustomerMaintenanceSummaryCard({ summary }: Props) {
  return (
    <MatrixCard
      title="Customer Maintenance Summary"
      subtitle={summary.customerName}
    >
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Fleet Health</p>
          <p className="text-4xl font-bold text-cyan-400">
            {summary.fleetHealth.insufficientData
              ? "—"
              : `${summary.fleetHealth.percentage}%`}
          </p>
          <p className="text-slate-300">{summary.fleetHealth.label}</p>
        </div>
        <p className="text-sm text-slate-500">
          Avg age:{" "}
          {summary.averageAgeYears === null
            ? "Insufficient data"
            : `${summary.averageAgeYears} yrs`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MatrixStatCard label="Total Printers" value={summary.totalPrinters} />
        <MatrixStatCard
          label="Current"
          value={summary.current}
          accent="text-emerald-400"
        />
        <MatrixStatCard
          label="Due Soon"
          value={summary.dueSoon}
          accent="text-amber-300"
        />
        <MatrixStatCard
          label="Due"
          value={summary.due}
          accent="text-orange-400"
        />
        <MatrixStatCard
          label="Overdue"
          value={summary.overdue}
          accent="text-rose-400"
        />
        <MatrixStatCard
          label="Monthly Volume"
          value={
            summary.monthlyVolume === null
              ? "—"
              : formatCopyCount(summary.monthlyVolume)
          }
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-slate-300">Recent Visits</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-400">
            {summary.recentVisits.length === 0 ? (
              <li>No recent visits recorded</li>
            ) : (
              summary.recentVisits.slice(0, 5).map((v) => (
                <li key={v.id}>
                  {v.kind} · {formatMaintenanceDate(v.completedAt)} ·{" "}
                  {v.technician}
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-300">Upcoming Visits</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-400">
            {summary.upcomingVisits.length === 0 ? (
              <li>No upcoming visits in planning window</li>
            ) : (
              summary.upcomingVisits.slice(0, 5).map((v) => (
                <li key={`${v.printerId}-${v.kind}`}>
                  {v.kind} · {v.printerName} · {v.estimatedDueDate ?? "—"}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </MatrixCard>
  );
}
