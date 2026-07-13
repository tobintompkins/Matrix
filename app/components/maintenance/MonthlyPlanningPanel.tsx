"use client";

import { MatrixCard } from "@/app/components/ui";
import {
  formatCopyCount,
  getMaintenanceStatusLabel,
  type MonthlyPlanningItem,
  type PlanningWindow,
} from "@/lib/maintenance";

const WINDOWS: { id: PlanningWindow; label: string }[] = [
  { id: "TODAY", label: "Today" },
  { id: "THIS_WEEK", label: "This Week" },
  { id: "NEXT_WEEK", label: "Next Week" },
  { id: "NEXT_MONTH", label: "Next Month" },
  { id: "NEXT_QUARTER", label: "Next Quarter" },
];

type Props = {
  window: PlanningWindow;
  onWindowChange: (w: PlanningWindow) => void;
  items: MonthlyPlanningItem[];
  onSelect: (printerId: string) => void;
};

export default function MonthlyPlanningPanel({
  window,
  onWindowChange,
  items,
  onSelect,
}: Props) {
  const pms = items.filter((i) => i.kind === "PM");
  const cleanings = items.filter((i) => i.kind === "CLEANING");
  const joints = items.filter((i) => i.kind === "JOINT_UNIT");
  const dtfs = items.filter((i) => i.kind === "DTF_PM");

  return (
    <MatrixCard
      title="Monthly Planning"
      subtitle="Upcoming PMs, cleanings, joint units, and DTF work"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onWindowChange(w.id)}
            className={
              window === w.id
                ? "rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                : "rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            }
          >
            {w.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "Upcoming PMs", list: pms },
          { title: "Upcoming Cleanings", list: cleanings },
          { title: "Joint Units", list: joints },
          { title: "DTF PMs", list: dtfs },
        ].map((section) => (
          <div
            key={section.title}
            className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
          >
            <p className="text-sm font-semibold text-cyan-300">
              {section.title} ({section.list.length})
            </p>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm">
              {section.list.length === 0 ? (
                <li className="text-slate-500">None in this window</li>
              ) : (
                section.list.slice(0, 8).map((item) => (
                  <li key={`${item.printerId}-${item.kind}`}>
                    <button
                      type="button"
                      className="text-left hover:text-cyan-300"
                      onClick={() => onSelect(item.printerId)}
                    >
                      <span className="font-medium">{item.printerName}</span>
                      <span className="block text-xs text-slate-500">
                        {getMaintenanceStatusLabel(item.status)} · rem{" "}
                        {formatCopyCount(item.copiesRemaining)} ·{" "}
                        {item.estimatedDueDate ?? "—"}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
    </MatrixCard>
  );
}
