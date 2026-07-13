"use client";

import {
  formatCopyCount,
  getMaintenanceEventLabel,
  type MaintenanceTimelineEvent,
} from "@/lib/maintenance";
import { MatrixCard, MatrixEmptyState } from "@/app/components/ui";

type Props = {
  events: MaintenanceTimelineEvent[];
};

const typeAccent: Record<MaintenanceTimelineEvent["type"], string> = {
  COPY_COUNT_ENTERED: "border-cyan-500/50",
  PM_COMPLETED: "border-emerald-500/50",
  CLEANING_COMPLETED: "border-blue-500/50",
  JOINT_UNIT: "border-violet-500/50",
  DTF_PM: "border-amber-500/50",
  BASELINE_CHANGED: "border-slate-400/50",
  INTERVAL_CHANGED: "border-orange-500/50",
  MAINTENANCE_CORRECTED: "border-rose-500/40",
};

export default function MaintenanceTimeline({ events }: Props) {
  return (
    <MatrixCard
      title="Maintenance Timeline"
      subtitle="Newest events first — copy counts, completions, baselines, and corrections."
    >
      {events.length === 0 ? (
        <MatrixEmptyState
          title="No maintenance events"
          description="Copy counts and PM events will appear here as they are recorded."
        />
      ) : (
        <ol className="space-y-3">
          {events.map((event) => (
            <li
              key={event.id}
              className={`rounded-lg border border-slate-800 border-l-4 bg-slate-950/50 px-4 py-3 ${typeAccent[event.type]}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {getMaintenanceEventLabel(event.type)}
                  </p>
                  <p className="mt-1 font-semibold text-white">{event.title}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {event.description}
                  </p>
                  {event.copyCount != null && (
                    <p className="mt-1 text-xs text-cyan-300">
                      Count: {formatCopyCount(event.copyCount)}
                    </p>
                  )}
                  {(event.previousValue || event.newValue) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {event.previousValue
                        ? `Previous: ${event.previousValue}`
                        : ""}
                      {event.previousValue && event.newValue ? " → " : ""}
                      {event.newValue ? `New: ${event.newValue}` : ""}
                    </p>
                  )}
                  {event.notes && (
                    <p className="mt-1 text-xs text-slate-400">
                      Notes: {event.notes}
                    </p>
                  )}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{event.occurredAt.replace("T", " ").slice(0, 19)}</p>
                  <p className="mt-1">{event.actor}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </MatrixCard>
  );
}
