/**
 * Copy count, automatic due calculations, fleet dashboard, and smart
 * notifications / predictive scheduling (Patches 33–36).
 *
 * Deferred (later patches): email/SMS/push delivery, AI predictions,
 * auto parts ordering, background worker infrastructure.
 */

export type MaintenanceKind = "PM" | "CLEANING" | "JOINT_UNIT" | "DTF_PM";

export type MaintenanceStatus =
  | "UNKNOWN"
  | "CURRENT"
  | "DUE_SOON"
  | "DUE"
  | "OVERDUE";

/** Display label for UNKNOWN when baseline is missing. */
export type MaintenanceStatusDisplay =
  | "Current"
  | "Due Soon"
  | "Due"
  | "Overdue"
  | "Setup Required";

export type MaintenanceIntervalConfig = {
  printerModel: string;
  /** Editable setup defaults — not hard-coded in UI components. */
  pmInterval: number;
  cleaningInterval: number;
  jointUnitInterval: number;
  dtfPmInterval: number;
  warningThreshold: number;
  notes: string;
};

export type CopyCountHistory = {
  id: string;
  printerId: string;
  recordedAt: string;
  copyCount: number;
  enteredBy: string;
  notes: string;
  previousCount: number | null;
  lowerCountReason: string | null;
};

export type MaintenanceCompletionRecord = {
  id: string;
  printerId: string;
  kind: MaintenanceKind;
  completedAt: string;
  copyCountAtCompletion: number;
  technician: string;
  notes: string;
  workPerformed: string;
};

export type MaintenanceEventType =
  | "COPY_COUNT_ENTERED"
  | "PM_COMPLETED"
  | "CLEANING_COMPLETED"
  | "JOINT_UNIT"
  | "DTF_PM"
  | "BASELINE_CHANGED"
  | "INTERVAL_CHANGED"
  | "MAINTENANCE_CORRECTED";

export type MaintenanceTimelineEvent = {
  id: string;
  printerId: string;
  type: MaintenanceEventType;
  title: string;
  description: string;
  occurredAt: string;
  actor: string;
  copyCount?: number | null;
  previousValue?: string | null;
  newValue?: string | null;
  notes?: string | null;
};

export type MaintenanceTypeSnapshot = {
  kind: MaintenanceKind;
  label: string;
  lastCompletedCopyCount: number | null;
  lastCompletedDate: string | null;
  nextDueCount: number | null;
  status: MaintenanceStatus;
  statusDisplay: MaintenanceStatusDisplay;
  copiesRemaining: number | null;
  copiesOverdue: number | null;
};

/**
 * Printer maintenance profile — mirrors Prisma Printer copy/PM fields.
 */
export type PrinterMaintenanceProfile = {
  printerId: string;
  assetTag: string;
  nickname: string;
  printerModel: string;
  customerName: string;
  siteName: string;
  currentCopyCount: number | null;
  previousCopyCount: number | null;
  monthlyVolume: number | null;
  lastPMDate: string | null;
  lastCleaningDate: string | null;
  lastJointUnitDate: string | null;
  lastDTFPMDate: string | null;
  /** Date placeholders (Patch 33) — not volume-estimated yet */
  nextPMDue: string | null;
  nextCleaningDue: string | null;
  nextJointUnitDue: string | null;
  nextDTFDue: string | null;
  /** Count baselines (Patch 34) */
  lastPMCopyCount: number | null;
  lastCleaningCopyCount: number | null;
  lastJointUnitCopyCount: number | null;
  lastDTFPMCopyCount: number | null;
  nextPMDueCount: number | null;
  nextCleaningDueCount: number | null;
  nextJointUnitDueCount: number | null;
  nextDTFDueCount: number | null;
};

export type FleetMaintenanceSummary = {
  totalPrinters: number;
  printersCurrent: number;
  printersDueSoon: number;
  printersDue: number;
  printersOverdue: number;
  printersSetupRequired: number;
  highest: {
    printerId: string;
    assetTag: string;
    nickname: string;
    count: number;
  } | null;
  lowest: {
    printerId: string;
    assetTag: string;
    nickname: string;
    count: number;
  } | null;
  averageFleetCount: number | null;
  totalFleetCopies: number | null;
  machinesWithCounts: number;
  insufficientData: boolean;
};

/** @deprecated Use FleetMaintenanceSummary — kept for Patch 33 callers */
export type FleetCopyCountStats = {
  highest: FleetMaintenanceSummary["highest"];
  lowest: FleetMaintenanceSummary["lowest"];
  averageFleetCount: number | null;
  totalFleetCopies: number | null;
  machinesWithCounts: number;
};

export type RecordCopyCountInput = {
  printerId: string;
  copyCount: number;
  notes: string;
  enteredBy: string;
  lowerCountReason?: string;
};

export type CompleteMaintenanceInput = {
  printerId: string;
  kind: MaintenanceKind;
  completedAt: string;
  copyCountAtCompletion: number;
  technician: string;
  notes: string;
  workPerformed: string;
};

export type InitialBaselineInput = {
  printerId: string;
  lastPMCopyCount: number | null;
  lastCleaningCopyCount: number | null;
  lastJointUnitCopyCount: number | null;
  lastDTFPMCopyCount: number | null;
  lastPMDate: string | null;
  lastCleaningDate: string | null;
  lastJointUnitDate: string | null;
  lastDTFPMDate: string | null;
  notes: string;
  enteredBy: string;
};

export type UpdateIntervalInput = {
  printerModel: string;
  patch: Partial<
    Omit<MaintenanceIntervalConfig, "printerModel" | "notes">
  > & { notes?: string };
  changedBy: string;
  reason: string;
};

export type MaintenanceCorrectionInput = {
  printerId: string;
  field: string;
  originalValue: string;
  correctedValue: string;
  correctedBy: string;
  reason: string;
};
