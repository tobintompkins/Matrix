import { getDefaultIntervalForModel } from "./intervals";
import type {
  MaintenanceIntervalConfig,
  MaintenanceKind,
  MaintenanceStatus,
  MaintenanceStatusDisplay,
  MaintenanceTypeSnapshot,
  PrinterMaintenanceProfile,
} from "./types";

export type StatusCalculation = {
  status: MaintenanceStatus;
  copiesRemaining: number | null;
  copiesOverdue: number | null;
};

/** nextDue = lastCompleted + interval; null when no baseline. */
export function calculateNextDueCount(
  lastCompletedCopyCount: number | null | undefined,
  interval: number,
): number | null {
  if (
    lastCompletedCopyCount === null ||
    lastCompletedCopyCount === undefined ||
    !Number.isFinite(lastCompletedCopyCount)
  ) {
    return null;
  }
  return Math.floor(lastCompletedCopyCount) + interval;
}

/**
 * Status rules:
 * UNKNOWN — missing current or due count
 * OVERDUE — current > due
 * DUE — current === due
 * DUE_SOON — remaining <= warningThreshold
 * CURRENT — remaining > warningThreshold
 */
export function calculateMaintenanceStatus(
  currentCopyCount: number | null | undefined,
  nextDueCount: number | null | undefined,
  warningThreshold: number,
): StatusCalculation {
  if (
    currentCopyCount === null ||
    currentCopyCount === undefined ||
    nextDueCount === null ||
    nextDueCount === undefined ||
    !Number.isFinite(currentCopyCount) ||
    !Number.isFinite(nextDueCount)
  ) {
    return {
      status: "UNKNOWN",
      copiesRemaining: null,
      copiesOverdue: null,
    };
  }

  const current = Math.floor(currentCopyCount);
  const due = Math.floor(nextDueCount);

  if (current > due) {
    return {
      status: "OVERDUE",
      copiesRemaining: 0,
      copiesOverdue: current - due,
    };
  }

  if (current === due) {
    return {
      status: "DUE",
      copiesRemaining: 0,
      copiesOverdue: 0,
    };
  }

  const remaining = due - current;
  if (remaining <= warningThreshold) {
    return {
      status: "DUE_SOON",
      copiesRemaining: remaining,
      copiesOverdue: 0,
    };
  }

  return {
    status: "CURRENT",
    copiesRemaining: remaining,
    copiesOverdue: 0,
  };
}

export function toStatusDisplay(
  status: MaintenanceStatus,
): MaintenanceStatusDisplay {
  switch (status) {
    case "CURRENT":
      return "Current";
    case "DUE_SOON":
      return "Due Soon";
    case "DUE":
      return "Due";
    case "OVERDUE":
      return "Overdue";
    case "UNKNOWN":
    default:
      return "Setup Required";
  }
}

export function intervalForKind(
  config: MaintenanceIntervalConfig,
  kind: MaintenanceKind,
): number {
  switch (kind) {
    case "PM":
      return config.pmInterval;
    case "CLEANING":
      return config.cleaningInterval;
    case "JOINT_UNIT":
      return config.jointUnitInterval;
    case "DTF_PM":
      return config.dtfPmInterval;
  }
}

export function recalculateDueCounts(
  profile: PrinterMaintenanceProfile,
  intervals: MaintenanceIntervalConfig,
): Pick<
  PrinterMaintenanceProfile,
  | "nextPMDueCount"
  | "nextCleaningDueCount"
  | "nextJointUnitDueCount"
  | "nextDTFDueCount"
> {
  return {
    nextPMDueCount: calculateNextDueCount(
      profile.lastPMCopyCount,
      intervals.pmInterval,
    ),
    nextCleaningDueCount: calculateNextDueCount(
      profile.lastCleaningCopyCount,
      intervals.cleaningInterval,
    ),
    nextJointUnitDueCount: calculateNextDueCount(
      profile.lastJointUnitCopyCount,
      intervals.jointUnitInterval,
    ),
    nextDTFDueCount: calculateNextDueCount(
      profile.lastDTFPMCopyCount,
      intervals.dtfPmInterval,
    ),
  };
}

const KIND_LABEL: Record<MaintenanceKind, string> = {
  PM: "Preventive Maintenance",
  CLEANING: "Cleaning",
  JOINT_UNIT: "Joint Unit PM",
  DTF_PM: "DTF PM",
};

export function buildMaintenanceTypeSnapshot(
  profile: PrinterMaintenanceProfile,
  kind: MaintenanceKind,
  intervals?: MaintenanceIntervalConfig,
): MaintenanceTypeSnapshot {
  const config = intervals ?? getDefaultIntervalForModel(profile.printerModel);
  const lastCount =
    kind === "PM"
      ? profile.lastPMCopyCount
      : kind === "CLEANING"
        ? profile.lastCleaningCopyCount
        : kind === "JOINT_UNIT"
          ? profile.lastJointUnitCopyCount
          : profile.lastDTFPMCopyCount;
  const lastDate =
    kind === "PM"
      ? profile.lastPMDate
      : kind === "CLEANING"
        ? profile.lastCleaningDate
        : kind === "JOINT_UNIT"
          ? profile.lastJointUnitDate
          : profile.lastDTFPMDate;
  const nextDue =
    kind === "PM"
      ? profile.nextPMDueCount
      : kind === "CLEANING"
        ? profile.nextCleaningDueCount
        : kind === "JOINT_UNIT"
          ? profile.nextJointUnitDueCount
          : profile.nextDTFDueCount;

  const calc = calculateMaintenanceStatus(
    profile.currentCopyCount,
    nextDue,
    config.warningThreshold,
  );

  return {
    kind,
    label: KIND_LABEL[kind],
    lastCompletedCopyCount: lastCount,
    lastCompletedDate: lastDate,
    nextDueCount: nextDue,
    status: calc.status,
    statusDisplay: toStatusDisplay(calc.status),
    copiesRemaining: calc.copiesRemaining,
    copiesOverdue: calc.copiesOverdue,
  };
}

export function buildAllMaintenanceSnapshots(
  profile: PrinterMaintenanceProfile,
  intervals?: MaintenanceIntervalConfig,
): MaintenanceTypeSnapshot[] {
  const kinds: MaintenanceKind[] = ["PM", "CLEANING", "JOINT_UNIT", "DTF_PM"];
  return kinds.map((k) => buildMaintenanceTypeSnapshot(profile, k, intervals));
}

const URGENCY_RANK: Record<MaintenanceStatus, number> = {
  OVERDUE: 5,
  DUE: 4,
  DUE_SOON: 3,
  UNKNOWN: 2,
  CURRENT: 1,
};

/** Most urgent status across all maintenance types for a printer. */
export function getMostUrgentMaintenanceStatus(
  profile: PrinterMaintenanceProfile,
  intervals?: MaintenanceIntervalConfig,
): MaintenanceStatus {
  const snaps = buildAllMaintenanceSnapshots(profile, intervals);
  return snaps.reduce(
    (worst, snap) =>
      URGENCY_RANK[snap.status] > URGENCY_RANK[worst] ? snap.status : worst,
    "CURRENT" as MaintenanceStatus,
  );
}

export function validateWholeNonNegativeCount(
  value: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (!Number.isFinite(value)) {
    return { ok: false, error: "Copy count must be a valid number." };
  }
  if (value < 0) {
    return { ok: false, error: "Copy count must be non-negative." };
  }
  if (!Number.isInteger(value)) {
    return { ok: false, error: "Copy count must be a whole number." };
  }
  return { ok: true, value };
}
