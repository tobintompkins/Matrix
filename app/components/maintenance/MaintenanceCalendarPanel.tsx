"use client";

import { useMemo, useState } from "react";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "@/app/components/ui";
import {
  buildMonthGrid,
  eventsForDate,
  scheduleMaintenance,
  toDateKey,
  updateMaintenanceSchedule,
  type CalendarViewMode,
  type MaintenanceQueueRow,
  type MaintenanceScheduleEvent,
  type SchedulePriority,
} from "@/lib/maintenance";
import { notifyScheduleChanged } from "@/lib/notifications";

type Props = {
  events: MaintenanceScheduleEvent[];
  canSchedule: boolean;
  technicians: string[];
  queue: MaintenanceQueueRow[];
  onChanged: () => void;
};

type DayCellProps = {
  date: Date;
  month: number;
  mode: CalendarViewMode;
  events: MaintenanceScheduleEvent[];
  canSchedule: boolean;
  compact?: boolean;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onMove: (id: string, dateIso: string) => void;
};

function DayCell({
  date,
  month,
  mode,
  events,
  canSchedule,
  compact,
  dragId,
  setDragId,
  onMove,
}: DayCellProps) {
  const key = toDateKey(date);
  const dayEvents = eventsForDate(events, key);
  const inMonth = date.getMonth() === month;

  return (
    <div
      className={`min-h-24 rounded-lg border border-slate-800 p-2 ${
        inMonth || mode !== "month"
          ? "bg-slate-950/40"
          : "bg-slate-900/30 opacity-50"
      }`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => {
        if (dragId) onMove(dragId, key);
        setDragId(null);
      }}
    >
      <p className="text-xs text-slate-400">{date.getDate()}</p>
      <ul className={`mt-1 space-y-1 ${compact ? "text-[10px]" : "text-xs"}`}>
        {dayEvents.map((ev) => (
          <li
            key={ev.id}
            draggable={canSchedule}
            onDragStart={() => setDragId(ev.id)}
            className="cursor-grab rounded bg-cyan-500/15 px-1.5 py-1 text-cyan-200"
            title={`${ev.kind} · ${ev.technician} · ${ev.priority}`}
          >
            {ev.kind} · {ev.printerName}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MaintenanceCalendarPanel({
  events,
  canSchedule,
  technicians,
  queue,
  onChanged,
}: Props) {
  const [mode, setMode] = useState<CalendarViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    printerId: queue[0]?.printerId ?? "",
    kind: "PM" as MaintenanceScheduleEvent["kind"],
    scheduledDate: toDateKey(new Date()),
    technician: technicians[0] ?? "",
    priority: "NORMAL" as SchedulePriority,
    expectedDurationHours: 2,
    notes: "",
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const weekStart = useMemo(() => {
    const d = new Date(cursor);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cursor]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  function moveEvent(id: string, dateIso: string) {
    if (!canSchedule) return;
    const result = updateMaintenanceSchedule({
      id,
      scheduledDate: dateIso,
      changedBy: "Matrix Planner",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    onChanged();
    notifyScheduleChanged({
      printerId: result.event.printerId,
      printerName: result.event.printerName,
      customerName: result.event.customerName,
      details: `Moved to ${dateIso}`,
    });
  }

  function createSchedule() {
    if (!canSchedule) {
      setError("You do not have permission to schedule maintenance.");
      return;
    }
    const row = queue.find((q) => q.printerId === form.printerId);
    if (!row) {
      setError("Select a printer.");
      return;
    }
    const result = scheduleMaintenance({
      printerId: row.printerId,
      printerName: row.printerName,
      customerName: row.customerName,
      siteName: row.siteName,
      kind: form.kind,
      scheduledDate: form.scheduledDate,
      technician: form.technician,
      priority: form.priority,
      expectedDurationHours: form.expectedDurationHours,
      notes: form.notes,
      createdBy: "Matrix Planner",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    onChanged();
    notifyScheduleChanged({
      printerId: row.printerId,
      printerName: row.printerName,
      customerName: row.customerName,
      details: `Scheduled ${form.kind} on ${form.scheduledDate} for ${form.technician}`,
    });
  }

  const cellProps = {
    month,
    mode,
    events,
    canSchedule,
    dragId,
    setDragId,
    onMove: moveEvent,
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <MatrixCard
        title="Maintenance Calendar"
        subtitle="Drag events to reschedule. Notifications are not sent yet."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["month", "week", "day"] as CalendarViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
                  : "rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
              }
            >
              {m === "month" ? "Month" : m === "week" ? "Week" : "Day"} View
            </button>
          ))}
          <MatrixButton
            variant="secondary"
            size="sm"
            onClick={() =>
              setCursor(
                new Date(
                  year,
                  month - (mode === "month" ? 1 : 0),
                  cursor.getDate() -
                    (mode === "day" ? 1 : mode === "week" ? 7 : 0),
                ),
              )
            }
          >
            Prev
          </MatrixButton>
          <MatrixButton
            variant="secondary"
            size="sm"
            onClick={() => setCursor(new Date())}
          >
            Today
          </MatrixButton>
          <MatrixButton
            variant="secondary"
            size="sm"
            onClick={() =>
              setCursor(
                new Date(
                  year,
                  month + (mode === "month" ? 1 : 0),
                  cursor.getDate() +
                    (mode === "day" ? 1 : mode === "week" ? 7 : 0),
                ),
              )
            }
          >
            Next
          </MatrixButton>
          <p className="text-sm text-slate-400">
            {cursor.toLocaleString("en-US", {
              month: "long",
              year: "numeric",
              day: mode === "day" ? "numeric" : undefined,
            })}
          </p>
        </div>

        {mode === "month" && (
          <>
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {grid.map((d) => (
                <DayCell
                  key={`${toDateKey(d)}-${d.getMonth()}`}
                  date={d}
                  compact
                  {...cellProps}
                />
              ))}
            </div>
          </>
        )}

        {mode === "week" && (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((d) => (
              <DayCell key={toDateKey(d)} date={d} {...cellProps} />
            ))}
          </div>
        )}

        {mode === "day" && <DayCell date={cursor} {...cellProps} />}

        {events.length === 0 && (
          <div className="mt-4">
            <MatrixEmptyState
              title="No scheduled visits"
              description="Use the planning form to schedule PM work."
            />
          </div>
        )}
      </MatrixCard>

      <MatrixCard
        title="Schedule Visit"
        subtitle="Assign technician, priority, duration"
      >
        {!canSchedule ? (
          <p className="text-sm text-amber-300">
            Scheduling requires manager or administrator permission.
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            <label className="block">
              <span className="text-slate-400">Printer</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={form.printerId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, printerId: e.target.value }))
                }
              >
                {queue.map((q) => (
                  <option key={q.printerId} value={q.printerId}>
                    {q.printerName} · {q.customerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400">Type</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as MaintenanceScheduleEvent["kind"],
                  }))
                }
              >
                <option value="PM">Preventive Maintenance</option>
                <option value="CLEANING">Cleaning</option>
                <option value="JOINT_UNIT">Joint Unit PM</option>
                <option value="DTF_PM">DTF PM</option>
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400">Date</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={form.scheduledDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, scheduledDate: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Technician</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={form.technician}
                onChange={(e) =>
                  setForm((f) => ({ ...f, technician: e.target.value }))
                }
              >
                {technicians.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400">Priority</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: e.target.value as SchedulePriority,
                  }))
                }
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400">Expected duration (hours)</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={form.expectedDurationHours}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    expectedDurationHours: Number(e.target.value),
                  }))
                }
              />
            </label>
            <label className="block">
              <span className="text-slate-400">Notes</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </label>
            {error && <p className="text-rose-400">{error}</p>}
            <MatrixButton variant="primary" size="md" onClick={createSchedule}>
              Schedule Visit
            </MatrixButton>
          </div>
        )}
      </MatrixCard>
    </div>
  );
}
