/**
 * Maintenance scheduling types & helpers (Patch 35).
 * Notifications are deferred — scheduling only.
 */

import type { MaintenanceKind } from "./types";

export type SchedulePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type CalendarViewMode = "month" | "week" | "day";

export type MaintenanceScheduleEvent = {
  id: string;
  printerId: string;
  printerName: string;
  customerName: string;
  siteName: string;
  kind: MaintenanceKind;
  scheduledDate: string; // YYYY-MM-DD
  technician: string;
  priority: SchedulePriority;
  expectedDurationHours: number;
  notes: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type ScheduleMaintenanceInput = {
  printerId: string;
  printerName: string;
  customerName: string;
  siteName: string;
  kind: MaintenanceKind;
  scheduledDate: string;
  technician: string;
  priority: SchedulePriority;
  expectedDurationHours: number;
  notes: string;
  createdBy: string;
};

export type UpdateScheduleInput = {
  id: string;
  scheduledDate?: string;
  technician?: string;
  priority?: SchedulePriority;
  expectedDurationHours?: number;
  notes?: string;
  changedBy: string;
};

export type MaintenanceAuditAction =
  | "SCHEDULE_CREATED"
  | "SCHEDULE_UPDATED"
  | "SCHEDULE_MOVED"
  | "ASSIGNMENT_CHANGED"
  | "STATUS_VIEWED"
  | "MAINTENANCE_COMPLETED"
  | "COPY_COUNT_ENTERED"
  | "EXPORT_GENERATED"
  | "DASHBOARD_ACTION"
  | "NOTIFICATION_CREATED"
  | "NOTIFICATION_READ"
  | "REMINDER_GENERATED"
  | "REMINDER_THRESHOLDS_UPDATED"
  | "NOTIFICATION_PREFERENCES_UPDATED"
  | "PREDICTION_RECALCULATED"
  | "TECHNICIAN_TASK_UPDATED"
  | "SCHEDULE_RECOMMENDATION";

export type MaintenanceAuditEntry = {
  id: string;
  action: MaintenanceAuditAction;
  actor: string;
  occurredAt: string;
  printerId?: string | null;
  details: string;
  previousValue?: string | null;
  newValue?: string | null;
};

export function eventsForDate(
  events: MaintenanceScheduleEvent[],
  dateIso: string,
): MaintenanceScheduleEvent[] {
  return events.filter((e) => e.scheduledDate === dateIso);
}

export function eventsInRange(
  events: MaintenanceScheduleEvent[],
  startIso: string,
  endIso: string,
): MaintenanceScheduleEvent[] {
  return events.filter(
    (e) => e.scheduledDate >= startIso && e.scheduledDate <= endIso,
  );
}

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function buildMonthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const total = daysInMonth(year, monthIndex);
  const cells: Date[] = [];
  for (let i = startPad - 1; i >= 0; i -= 1) {
    cells.push(new Date(year, monthIndex, -i));
  }
  for (let d = 1; d <= total; d += 1) {
    cells.push(new Date(year, monthIndex, d));
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    cells.push(
      new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
    );
  }
  return cells;
}
