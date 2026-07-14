/**
 * Centralized PM / cleaning status calculation (Patch 45).
 *
 * Master impression meter (currentCopyCount) drives PM.
 * Status vocabulary: Not Configured | Good | Due Soon | Due | Overdue
 */

import type { MaintenanceStatus } from "./types";

export type PmCleaningStatus =
  | "NOT_CONFIGURED"
  | "GOOD"
  | "DUE_SOON"
  | "DUE"
  | "OVERDUE";

export type PmStatusDisplayLabel =
  | "Not Configured"
  | "Good"
  | "Due Soon"
  | "Due"
  | "Overdue";

export type PmCleaningStatusResult = {
  status: PmCleaningStatus;
  nextPmDueCount: number | null;
  countsRemaining: number | null;
  countsOverdue: number | null;
  displayLabel: PmStatusDisplayLabel;
};

export type CalculatePmCleaningStatusInput = {
  currentCount: number | null | undefined;
  lastPmCount: number | null | undefined;
  /** null / missing / <= 0 ⇒ Not Configured */
  pmInterval: number | null | undefined;
  /** When omitted, uses 10% of interval (min 1). */
  dueSoonThreshold?: number | null | undefined;
};

export const PM_STATUS_DISPLAY_LABELS: Record<
  PmCleaningStatus,
  PmStatusDisplayLabel
> = {
  NOT_CONFIGURED: "Not Configured",
  GOOD: "Good",
  DUE_SOON: "Due Soon",
  DUE: "Due",
  OVERDUE: "Overdue",
};

function isValidNonNegativeNumber(
  value: number | null | undefined,
): value is number {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function isValidPositiveInterval(
  value: number | null | undefined,
): value is number {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(value) &&
    value > 0
  );
}

/** nextDue = lastPmCount + interval; null when baseline or interval missing. */
export function calculateNextPmDueCount(
  lastPmCount: number | null | undefined,
  interval: number | null | undefined,
): number | null {
  if (!isValidNonNegativeNumber(lastPmCount)) return null;
  if (!isValidPositiveInterval(interval)) return null;
  return Math.floor(lastPmCount) + Math.floor(interval);
}

/** Counts remaining until due; 0 when at/past due; null when inputs missing. */
export function calculateCountsRemaining(
  current: number | null | undefined,
  nextDue: number | null | undefined,
): number | null {
  if (!isValidNonNegativeNumber(current)) return null;
  if (nextDue === null || nextDue === undefined || !Number.isFinite(nextDue)) {
    return null;
  }
  const remaining = Math.floor(nextDue) - Math.floor(current);
  return remaining > 0 ? remaining : 0;
}

/**
 * Explicit threshold wins when finite and >= 0.
 * Otherwise Math.max(1, floor(interval * 0.1)).
 */
export function resolveDueSoonThreshold(
  interval: number,
  explicitThreshold?: number | null,
): number {
  if (
    explicitThreshold !== null &&
    explicitThreshold !== undefined &&
    Number.isFinite(explicitThreshold) &&
    explicitThreshold >= 0
  ) {
    return Math.floor(explicitThreshold);
  }
  if (!Number.isFinite(interval) || interval <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(interval * 0.1));
}

function notConfigured(
  nextPmDueCount: number | null = null,
): PmCleaningStatusResult {
  return {
    status: "NOT_CONFIGURED",
    nextPmDueCount,
    countsRemaining: null,
    countsOverdue: null,
    displayLabel: PM_STATUS_DISPLAY_LABELS.NOT_CONFIGURED,
  };
}

/**
 * Centralized PM status from meter + last PM + interval.
 *
 * Rules:
 * - Missing / invalid interval or last PM baseline → NOT_CONFIGURED
 * - Missing / invalid current meter → NOT_CONFIGURED (still expose next due when possible)
 * - current > nextDue → OVERDUE
 * - current === nextDue → DUE
 * - remaining <= dueSoonThreshold → DUE_SOON
 * - else → GOOD
 */
export function calculatePmCleaningStatus(
  input: CalculatePmCleaningStatusInput,
): PmCleaningStatusResult {
  const { currentCount, lastPmCount, pmInterval, dueSoonThreshold } = input;

  if (!isValidPositiveInterval(pmInterval)) {
    return notConfigured(null);
  }

  if (!isValidNonNegativeNumber(lastPmCount)) {
    return notConfigured(null);
  }

  const nextPmDueCount = calculateNextPmDueCount(lastPmCount, pmInterval);
  if (nextPmDueCount === null) {
    return notConfigured(null);
  }

  if (!isValidNonNegativeNumber(currentCount)) {
    return notConfigured(nextPmDueCount);
  }

  const current = Math.floor(currentCount);
  const due = Math.floor(nextPmDueCount);
  const threshold = resolveDueSoonThreshold(pmInterval, dueSoonThreshold);

  if (current > due) {
    return {
      status: "OVERDUE",
      nextPmDueCount: due,
      countsRemaining: 0,
      countsOverdue: current - due,
      displayLabel: PM_STATUS_DISPLAY_LABELS.OVERDUE,
    };
  }

  if (current === due) {
    return {
      status: "DUE",
      nextPmDueCount: due,
      countsRemaining: 0,
      countsOverdue: 0,
      displayLabel: PM_STATUS_DISPLAY_LABELS.DUE,
    };
  }

  const remaining = due - current;
  if (remaining <= threshold) {
    return {
      status: "DUE_SOON",
      nextPmDueCount: due,
      countsRemaining: remaining,
      countsOverdue: 0,
      displayLabel: PM_STATUS_DISPLAY_LABELS.DUE_SOON,
    };
  }

  return {
    status: "GOOD",
    nextPmDueCount: due,
    countsRemaining: remaining,
    countsOverdue: 0,
    displayLabel: PM_STATUS_DISPLAY_LABELS.GOOD,
  };
}

/** Map Patch 45 status → legacy MaintenanceStatus (CURRENT ↔ GOOD, etc.). */
export function toLegacyMaintenanceStatus(
  status: PmCleaningStatus,
): MaintenanceStatus {
  switch (status) {
    case "GOOD":
      return "CURRENT";
    case "NOT_CONFIGURED":
      return "UNKNOWN";
    case "DUE_SOON":
      return "DUE_SOON";
    case "DUE":
      return "DUE";
    case "OVERDUE":
      return "OVERDUE";
    default:
      return "UNKNOWN";
  }
}

/** Map legacy MaintenanceStatus → Patch 45 status. */
export function mapLegacyMaintenanceStatus(
  status: MaintenanceStatus,
): PmCleaningStatus {
  switch (status) {
    case "CURRENT":
      return "GOOD";
    case "UNKNOWN":
      return "NOT_CONFIGURED";
    case "DUE_SOON":
      return "DUE_SOON";
    case "DUE":
      return "DUE";
    case "OVERDUE":
      return "OVERDUE";
    default:
      return "NOT_CONFIGURED";
  }
}

export function toPmStatusDisplayLabel(
  status: PmCleaningStatus,
): PmStatusDisplayLabel {
  return PM_STATUS_DISPLAY_LABELS[status] ?? "Not Configured";
}
