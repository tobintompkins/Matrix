"use client";

import { MatrixCard, MatrixStatusBadge } from "@/app/components/ui";
import {
  formatCopyCount,
  getMaintenanceStatusLabel,
  mapStatusColor,
  type MaintenanceQueueRow,
} from "@/lib/maintenance";

type Props = {
  rows: MaintenanceQueueRow[];
  onSelect: (row: MaintenanceQueueRow) => void;
};

const COLOR: Record<string, string> = {
  green: "bg-emerald-400",
  yellow: "bg-amber-300",
  orange: "bg-orange-400",
  red: "bg-rose-500",
  gray: "bg-slate-400",
};

export default function MaintenanceFleetMap({ rows, onSelect }: Props) {
  // Project US-ish lon/lat into a simple SVG plane for the planning map.
  const points = rows.map((row) => {
    const x = ((row.longitude + 125) / 60) * 100;
    const y = ((50 - row.latitude) / 30) * 100;
    return {
      row,
      x: Math.min(96, Math.max(4, x)),
      y: Math.min(92, Math.max(8, y)),
      color: mapStatusColor(row.status),
    };
  });

  return (
    <MatrixCard
      title="Fleet Map"
      subtitle="Printer locations by region (development coordinates). Status colors: green / yellow / orange / red / gray."
    >
      <div className="relative h-[420px] overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {points.map((p) => (
          <button
            key={p.row.printerId}
            type="button"
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onClick={() => onSelect(p.row)}
            title={`${p.row.printerName} · ${getMaintenanceStatusLabel(p.row.status)}`}
          >
            <span
              className={`block h-3.5 w-3.5 rounded-full border border-slate-950 shadow ${COLOR[p.color]}`}
            />
            <span className="mt-1 block max-w-24 truncate text-[10px] text-slate-300">
              {p.row.assetTag}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Current
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> Due Soon
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Due
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Overdue
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Setup Required
        </span>
      </div>

      <ul className="mt-4 grid gap-2 md:grid-cols-2">
        {rows.slice(0, 8).map((row) => (
          <li key={row.printerId}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-left text-sm hover:bg-slate-950"
              onClick={() => onSelect(row)}
            >
              <span>
                {row.printerName}
                <span className="block text-xs text-slate-500">
                  {row.region} · {formatCopyCount(row.currentCount)}
                </span>
              </span>
              <MatrixStatusBadge
                variant={
                  row.status === "OVERDUE"
                    ? "error"
                    : row.status === "CURRENT"
                      ? "completed"
                      : row.status === "UNKNOWN"
                        ? "offline"
                        : "warning"
                }
                label={getMaintenanceStatusLabel(row.status)}
              />
            </button>
          </li>
        ))}
      </ul>
    </MatrixCard>
  );
}
