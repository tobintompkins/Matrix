export type {
  CompleteMaintenanceInput,
  CopyCountHistory,
  FleetCopyCountStats,
  FleetMaintenanceSummary,
  InitialBaselineInput,
  MaintenanceCompletionRecord,
  MaintenanceCorrectionInput,
  MaintenanceEventType,
  MaintenanceIntervalConfig,
  MaintenanceKind,
  MaintenanceStatus,
  MaintenanceStatusDisplay,
  MaintenanceTimelineEvent,
  MaintenanceTypeSnapshot,
  PrinterMaintenanceProfile,
  RecordCopyCountInput,
  UpdateIntervalInput,
} from "./types";

export type {
  ChartBucket,
  CustomerMaintenanceSummaryData,
  DashboardChartData,
  FleetDashboardMetrics,
  FleetHealthLabel,
  FleetHealthScore,
  MaintenanceDashboardFilters,
  MaintenanceQueueRow,
  MaintenanceQueueSortKey,
  MonthlyPlanningItem,
  PlanningWindow,
  TechnicianDashboardData,
} from "./dashboard";

export type {
  CalendarViewMode,
  MaintenanceAuditAction,
  MaintenanceAuditEntry,
  MaintenanceScheduleEvent,
  ScheduleMaintenanceInput,
  SchedulePriority,
  UpdateScheduleInput,
} from "./scheduling";

export type {
  ExportFormat,
  ExportOptions,
  ExportScope,
} from "./export";

export {
  buildAllMaintenanceSnapshots,
  buildMaintenanceTypeSnapshot,
  calculateMaintenanceStatus,
  calculateNextDueCount,
  getMostUrgentMaintenanceStatus,
  intervalForKind,
  recalculateDueCounts,
  toStatusDisplay,
  validateWholeNonNegativeCount,
} from "./calculations";

export {
  DEFAULT_CLEANING_INTERVAL,
  DEFAULT_DTF_PM_INTERVAL,
  DEFAULT_JOINT_UNIT_INTERVAL,
  DEFAULT_PM_INTERVAL,
  DEFAULT_WARNING_THRESHOLD,
  defaultMaintenanceIntervals,
  getDefaultIntervalForModel,
  resolvePrinterModelKey,
} from "./intervals";

export {
  sampleCopyCountHistory,
  sampleMaintenanceCompletions,
  sampleMaintenanceProfiles,
  sampleMaintenanceTimeline,
} from "./data";

export {
  computeFleetCopyCountStats,
  computeFleetMaintenanceSummary,
  formatCopyCount,
  formatMaintenanceDate,
  getMaintenanceEventLabel,
  getMaintenanceStatusLabel,
  normalizePrinterId,
  profileNeedsSetup,
} from "./helpers";

export {
  buildCustomerMaintenanceSummary,
  buildDashboardCharts,
  buildMaintenanceQueueRows,
  buildMonthlyPlanning,
  buildTechnicianDashboard,
  computeFleetDashboardMetrics,
  computeFleetHealthScore,
  defaultMaintenanceDashboardFilters,
  filterMaintenanceQueue,
  mapStatusColor,
  paginateRows,
  sortMaintenanceQueue,
} from "./dashboard";

export {
  buildMonthGrid,
  daysInMonth,
  eventsForDate,
  eventsInRange,
  toDateKey,
} from "./scheduling";

export {
  buildExportPayload,
  buildMaintenanceCsv,
  buildMaintenanceExcelXml,
  buildMaintenancePdfText,
  downloadTextFile,
  filterRowsForExport,
} from "./export";

export {
  completeMaintenance,
  getIntervalConfig,
  getMaintenanceProfile,
  listAllMaintenanceCompletions,
  listCopyCountHistory,
  listIntervalConfigs,
  listMaintenanceAudit,
  listMaintenanceCompletions,
  listMaintenanceProfiles,
  listMaintenanceSchedules,
  listMaintenanceTimeline,
  recordCopyCount,
  recordMaintenanceAudit,
  recordMaintenanceCorrection,
  saveInitialBaseline,
  scheduleMaintenance,
  updateIntervalConfig,
  updateMaintenanceSchedule,
} from "./repository";
