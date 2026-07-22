/**
 * Patch 50A — SLA / waiting-time helpers (server timestamps).
 */

import type { SlaClassification } from "./types";

export function formatWaitingDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0 minutes";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) {
    return `${Math.max(1, minutes) || 0} minute${minutes === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function classifySla(input: {
  dueAt: Date | string | null | undefined;
  waitingSince: Date | string | null | undefined;
  now?: Date;
}): SlaClassification {
  const now = input.now ?? new Date();
  const due = input.dueAt ? new Date(input.dueAt) : null;
  if (due && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime()) {
    return "Overdue";
  }
  if (due && !Number.isNaN(due.getTime())) {
    const remaining = due.getTime() - now.getTime();
    const totalWindow = input.waitingSince
      ? due.getTime() - new Date(input.waitingSince).getTime()
      : 48 * 3600_000;
    const ratio = totalWindow > 0 ? remaining / totalWindow : 1;
    if (ratio <= 0.15) return "At Risk";
    if (ratio <= 0.35) return "Warning";
    return "Healthy";
  }
  const since = input.waitingSince ? new Date(input.waitingSince) : null;
  if (!since || Number.isNaN(since.getTime())) return "Healthy";
  const waited = now.getTime() - since.getTime();
  if (waited > 72 * 3600_000) return "At Risk";
  if (waited > 24 * 3600_000) return "Warning";
  return "Healthy";
}

export function isOverdue(
  dueAt: Date | string | null | undefined,
  now = new Date(),
): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

/**
 * Future scheduled escalation hook — not invoked automatically in Patch 50A.
 * Call from a worker/cron when Matrix adds a background scheduler.
 */
export async function processOverdueEscalations(_organizationId: string): Promise<{
  scanned: number;
  escalated: number;
  note: string;
}> {
  return {
    scanned: 0,
    escalated: 0,
    note: "Background escalation is not scheduled in Patch 50A. Overdue is computed on read.",
  };
}
