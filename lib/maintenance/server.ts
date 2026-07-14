/**
 * Server-only entry for Patch 45 Prisma PM repository.
 * Prefer this (or `./pm-prisma-repository`) from API routes / RSC / server actions.
 */

export type {
  CompletePmInput,
  ListPmHistoryFilters,
  PmDashboardFilters,
  PmDashboardRow,
  PmDashboardSummary,
  RecordPmMeterReadingInput,
  SetMachinePmIntervalInput,
} from "./pm-prisma-repository";

export {
  completePm,
  ensurePmFleetSeeded,
  exportPmHistoryCsv,
  getMachinePmDetail,
  getPmDashboardSummary,
  listPmDashboardRows,
  listPmHistory,
  recordPmMeterReading,
  setMachinePmInterval,
} from "./pm-prisma-repository";

export type {
  CalculatePmCleaningStatusInput,
  PmCleaningStatus,
  PmCleaningStatusResult,
  PmStatusDisplayLabel,
} from "./pm-status";

export {
  calculateCountsRemaining,
  calculateNextPmDueCount,
  calculatePmCleaningStatus,
  mapLegacyMaintenanceStatus,
  PM_STATUS_DISPLAY_LABELS,
  resolveDueSoonThreshold,
  toLegacyMaintenanceStatus,
  toPmStatusDisplayLabel,
} from "./pm-status";
