"use client";

import { MatrixCard, MatrixStatCard } from "@/app/components/ui";
import {
  formatCopyCount,
  formatMaintenanceDate,
  getMaintenanceStatusLabel,
  type TechnicianDashboardData,
} from "@/lib/maintenance";

type Props = {
  data: TechnicianDashboardData;
};

function MachineList({
  title,
  rows,
}: {
  title: string;
  rows: TechnicianDashboardData["assignedMachines"];
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-sm font-semibold text-cyan-300">
        {title} ({rows.length})
      </p>
      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
        {rows.length === 0 ? (
          <li className="text-slate-500">None</li>
        ) : (
          rows.slice(0, 10).map((r) => (
            <li key={r.printerId}>
              <span className="font-medium text-slate-200">{r.printerName}</span>
              <span className="block text-xs text-slate-500">
                {getMaintenanceStatusLabel(r.status)} ·{" "}
                {formatCopyCount(r.currentCount)} · {r.siteName}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default function TechnicianDashboardPanel({ data }: Props) {
  return (
    <div className="space-y-6">
      <MatrixCard
        title="Technician Dashboard"
        subtitle={`${data.technician} — assigned work and completion metrics`}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MatrixStatCard
            label="Assigned Machines"
            value={data.assignedMachines.length}
          />
          <MatrixStatCard
            label="Overdue PMs"
            value={data.overduePms.length}
            accent="text-rose-400"
          />
          <MatrixStatCard
            label="Completion Rate"
            value={
              data.completionRate === null ? "—" : `${data.completionRate}%`
            }
            accent="text-cyan-400"
          />
          <MatrixStatCard
            label="Avg Completion Time"
            value={
              data.averageCompletionTimeHours === null
                ? "—"
                : `${data.averageCompletionTimeHours}h`
            }
          />
        </div>
      </MatrixCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MachineList title="Today's PMs" rows={data.todaysPms} />
        <MachineList title="Tomorrow's PMs" rows={data.tomorrowsPms} />
        <MachineList title="Overdue PMs" rows={data.overduePms} />
        <MachineList title="Assigned Machines" rows={data.assignedMachines} />
        <MachineList title="Weekly Schedule" rows={data.weeklySchedule} />
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="text-sm font-semibold text-cyan-300">
            Recently Completed PMs
          </p>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm text-slate-400">
            {data.recentlyCompleted.length === 0 ? (
              <li>No completions yet</li>
            ) : (
              data.recentlyCompleted.map((c) => (
                <li key={c.id}>
                  {c.kind} · {formatMaintenanceDate(c.completedAt)} ·{" "}
                  {formatCopyCount(c.copyCountAtCompletion)}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
