/**
 * Patch 51C.1 — Technician productivity from service calls + dispatch roster.
 */

import { listServiceCalls } from "@/lib/service-calls";
import { isOpenServiceCallStatus } from "@/lib/service-calls/workflow";
import { listTechnicians } from "@/lib/service-dispatch";

export type TechnicianProductivityRow = {
  name: string;
  status: string;
  openCalls: number;
  criticalCalls: number;
  closedInRange: number;
  completionRate: number | null;
  workloadHours: number;
  /** Assumed capacity: 8h × weekdays in range (explainable proxy). */
  capacityHours: number;
  workloadVsCapacityPct: number | null;
  territory: string;
  href: string;
};

export type TechnicianProductivityAnalytics = {
  generatedAt: string;
  days: number;
  rows: TechnicianProductivityRow[];
  empty: boolean;
  emptyMessage: string | null;
};

const CLOSED = new Set(["RESOLVED", "CLOSED", "COMPLETED", "CANCELLED"]);

function inRange(iso: string | null | undefined, startMs: number, endMs: number) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= startMs && t < endMs;
}

function weekdayCapacityHours(days: number): number {
  const weekdays = Math.max(1, Math.round(days * (5 / 7)));
  return weekdays * 8;
}

export function getTechnicianProductivityAnalytics(input?: {
  days?: number;
  now?: Date;
}): TechnicianProductivityAnalytics {
  const days = input?.days ?? 30;
  const now = input?.now ?? new Date();
  const endMs = now.getTime();
  const startMs = endMs - days * 86_400_000;
  const capacityHours = weekdayCapacityHours(days);

  const technicians = listTechnicians();
  const calls = listServiceCalls({ includeDeleted: false });

  const rows: TechnicianProductivityRow[] = technicians.map((t) => {
    const nameKey = t.name.trim().toLowerCase();
    const assignedOpen = calls.filter(
      (c) =>
        isOpenServiceCallStatus(c.status) &&
        c.assignment.technician?.trim().toLowerCase() === nameKey,
    );
    const critical = assignedOpen.filter(
      (c) =>
        c.priority === "CRITICAL" ||
        c.priority === "EMERGENCY" ||
        c.problem.machineCurrentlyDown,
    );
    const closedInRange = calls.filter((c) => {
      if (c.assignment.technician?.trim().toLowerCase() !== nameKey) return false;
      if (!CLOSED.has(String(c.status).toUpperCase())) return false;
      const when = c.updatedAt || c.closedAt || c.createdAt;
      return inRange(when, startMs, endMs);
    }).length;

    const handled = assignedOpen.length + closedInRange;
    const completionRate =
      handled === 0 ? null : Math.round((closedInRange / handled) * 1000) / 10;

    const workloadHours = t.estimatedWorkloadHours ?? 0;
    const workloadVsCapacityPct =
      capacityHours > 0
        ? Math.round((workloadHours / capacityHours) * 1000) / 10
        : null;

    return {
      name: t.name,
      status: t.status,
      openCalls: assignedOpen.length,
      criticalCalls: critical.length,
      closedInRange,
      completionRate,
      workloadHours,
      capacityHours,
      workloadVsCapacityPct,
      territory: t.territory ?? "",
      href: "/field",
    };
  });

  rows.sort(
    (a, b) =>
      b.criticalCalls - a.criticalCalls ||
      b.openCalls - a.openCalls ||
      b.closedInRange - a.closedInRange,
  );

  return {
    generatedAt: now.toISOString(),
    days,
    rows,
    empty: rows.length === 0,
    emptyMessage:
      rows.length === 0 ? "No technician roster loaded." : null,
  };
}
