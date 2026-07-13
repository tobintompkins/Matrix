export type {
  DashboardAlertWidget,
  GroupedVisitRecommendation,
  MaintenancePrediction,
  MaintenanceRecommendation,
  MatrixNotification,
  NotificationFilterState,
  NotificationPreferences,
  NotificationPriority,
  NotificationType,
  PredictionConfidence,
  PrinterHealthIndicators,
  ReminderThresholdConfig,
  TechnicianTask,
} from "./types";

export {
  DEFAULT_REMINDER_THRESHOLDS,
  defaultNotificationFilters,
  defaultNotificationPreferences,
} from "./types";

export {
  countUnread,
  filterNotifications,
  sortNotificationsNewestFirst,
} from "./helpers";

export {
  buildMaintenancePredictions,
  estimateMaintenanceDueDate,
  estimateMonthlyVolumeFromHistory,
  predictionConfidence,
} from "./predictions";

export {
  createEventNotification,
  generateMaintenanceReminders,
} from "./reminders";

export {
  buildMaintenanceRecommendations,
  computeCopyVolumeTrend,
  computePrinterHealthIndicators,
} from "./health";

export {
  buildDashboardAlertWidgets,
  buildTechnicianTaskList,
  groupVisitsByCustomerSite,
} from "./planning";

export {
  ensureDailyReminders,
  getNotificationPreferences,
  getPrinterHealth,
  getPrinterPredictions,
  getPrinterRecommendations,
  getReminderThresholds,
  getUnreadNotificationCount,
  listDashboardAlertWidgets,
  listGroupedVisitRecommendations,
  listNotifications,
  listTechnicianTasks,
  markAllNotificationsRead,
  markNotificationRead,
  notifyCopyCountUpdated,
  notifyMaintenanceCompleted,
  notifyScheduleChanged,
  notifyTicketEvent,
  notifyInventoryEvent,
  pushNotification,
  recalculatePrinterPredictions,
  saveNotificationPreferences,
  updateReminderThresholds,
  updateTechnicianTask,
} from "./repository";
