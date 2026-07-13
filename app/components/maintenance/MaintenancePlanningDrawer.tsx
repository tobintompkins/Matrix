"use client";

import Link from "next/link";
import { useState } from "react";
import { MatrixButton, MatrixStatusBadge } from "@/app/components/ui";
import {
  formatCopyCount,
  formatMaintenanceDate,
  getMaintenanceStatusLabel,
  scheduleMaintenance,
  type MaintenanceKind,
  type MaintenanceQueueRow,
  type SchedulePriority,
} from "@/lib/maintenance";

type Props = {
  row: MaintenanceQueueRow;
  canSchedule: boolean;
  canComplete: boolean;
  onClose: () => void;
  onComplete: (kind: MaintenanceKind) => void;
  onEnterCount: () => void;
  onScheduled: () => void;
};

function statusVariant(status: MaintenanceQueueRow["status"]) {
  switch (status) {
    case "CURRENT":
      return "completed" as const;
    case "DUE_SOON":
    case "DUE":
      return "warning" as const;
    case "OVERDUE":
      return "error" as const;
    default:
      return "offline" as const;
  }
}

export default function MaintenancePlanningDrawer({
  row,
  canSchedule,
  canComplete,
  onClose,
  onComplete,
  onEnterCount,
  onScheduled,
}: Props) {
  const [scheduleDate, setScheduleDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [priority, setPriority] = useState<SchedulePriority>("NORMAL");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  function schedulePm() {
    if (!canSchedule) {
      setMessage("Scheduling requires manager permission.");
      return;
    }
    const result = scheduleMaintenance({
      printerId: row.printerId,
      printerName: row.printerName,
      customerName: row.customerName,
      siteName: row.siteName,
      kind: "PM",
      scheduledDate: scheduleDate,
      technician: row.assignedTechnician,
      priority,
      expectedDurationHours: 3,
      notes,
      createdBy: "Matrix Planner",
    });
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setMessage("PM scheduled.");
    onScheduled();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-lg overflow-y-auto border-l border-slate-800 bg-slate-900 p-6 shadow-2xl"
        role="dialog"
        aria-label="Maintenance planning"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
              Planning Center
            </p>
            <h3 className="mt-1 text-2xl font-bold">{row.printerName}</h3>
            <p className="text-sm text-slate-400">
              {row.customerName} · {row.siteName}
            </p>
          </div>
          <MatrixButton variant="secondary" size="sm" onClick={onClose}>
            Close
          </MatrixButton>
        </div>

        <div className="mt-6 flex h-36 items-center justify-center rounded-xl border border-slate-800 bg-slate-950">
          <div className="text-center">
            <p className="text-3xl font-bold text-cyan-400">
              {row.photoPlaceholder}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Printer photo placeholder
            </p>
          </div>
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Address</dt>
            <dd className="text-right text-slate-200">{row.address}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Copy count</dt>
            <dd>{formatCopyCount(row.currentCount)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Monthly volume</dt>
            <dd>{formatCopyCount(row.monthlyVolume)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Open tickets</dt>
            <dd>{row.openServiceTickets}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Last PM</dt>
            <dd>{formatMaintenanceDate(row.lastPmDate)}</dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-2">
          {(
            [
              ["PM", row.pmStatus],
              ["Cleaning", row.cleaningStatus],
              ["Joint Unit", row.jointStatus],
              ["DTF", row.dtfStatus],
            ] as const
          ).map(([label, status]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2"
            >
              <span className="text-sm text-slate-300">{label}</span>
              <MatrixStatusBadge
                variant={statusVariant(status)}
                label={getMaintenanceStatusLabel(status)}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
          <p className="font-semibold text-cyan-300">Recommended next</p>
          <p className="mt-1 text-slate-300">
            {getMaintenanceStatusLabel(row.status)} — prioritize{" "}
            {row.status === "UNKNOWN" ? "baseline setup" : "PM / cleaning"} for{" "}
            {row.printerName}. Copies remaining:{" "}
            {formatCopyCount(row.copiesRemaining)}.
          </p>
        </div>

        {canSchedule && (
          <div className="mt-6 space-y-3 rounded-lg border border-slate-800 p-3">
            <p className="text-sm font-semibold">Schedule PM</p>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as SchedulePriority)
              }
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <MatrixButton variant="primary" size="sm" onClick={schedulePm}>
              Schedule PM
            </MatrixButton>
          </div>
        )}

        {message && <p className="mt-3 text-sm text-cyan-300">{message}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          {canComplete && (
            <MatrixButton
              variant="primary"
              size="sm"
              onClick={() => onComplete("PM")}
            >
              Complete PM
            </MatrixButton>
          )}
          <MatrixButton variant="secondary" size="sm" onClick={onEnterCount}>
            Enter Copy Count
          </MatrixButton>
          <MatrixButton
            href={`/digital-twin/${row.printerId}`}
            variant="secondary"
            size="sm"
          >
            Open Printer
          </MatrixButton>
          <MatrixButton
            href={`/parts-order-builder?assetId=${encodeURIComponent(row.assetTag)}`}
            variant="secondary"
            size="sm"
          >
            Open Parts
          </MatrixButton>
          <Link
            href={`/digital-twin/${row.printerId}`}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            View History
          </Link>
        </div>

        <div className="mt-6 text-sm text-slate-400">
          <p className="font-semibold text-slate-300">Recent context</p>
          <p className="mt-1">
            Open service tickets: {row.openServiceTickets}. Recent repairs and
            parts usage are available on the Digital Twin maintenance tab.
          </p>
        </div>
      </aside>
    </div>
  );
}
