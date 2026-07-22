/**
 * Smart maintenance notifications (Patch 36).
 * In-app first; email/SMS channels reserved in preferences without schema churn.
 */

export type NotificationType =
  | "PM_DUE_SOON"
  | "PM_DUE"
  | "PM_OVERDUE"
  | "CLEANING_DUE"
  | "JOINT_UNIT_DUE"
  | "DTF_PM_DUE"
  | "MAINTENANCE_COMPLETED"
  | "COPY_COUNT_UPDATED"
  | "SCHEDULE_CHANGED"
  | "TICKET_CREATED"
  | "TICKET_ASSIGNED"
  | "TICKET_ACCEPTED"
  | "TICKET_DECLINED"
  | "TICKET_REASSIGNED"
  | "TICKET_SCHEDULE_CHANGED"
  | "TICKET_PRIORITY_INCREASED"
  | "TECHNICIAN_TRAVELING"
  | "TECHNICIAN_ARRIVED"
  | "PARTS_REQUESTED"
  | "PARTS_RECEIVED"
  | "TICKET_WAITING_FOR_PARTS"
  | "SLA_WARNING"
  | "SLA_BREACH"
  | "TICKET_ESCALATED"
  | "FOLLOW_UP_REQUIRED"
  | "TICKET_RESOLVED"
  | "TICKET_CLOSED"
  | "TICKET_REOPENED"
  | "CUSTOMER_RESPONSE"
  | "INVENTORY_CRITICAL_STOCK"
  | "INVENTORY_OUT_OF_STOCK"
  | "INVENTORY_RECEIVING_COMPLETED"
  | "INVENTORY_TRANSFER_DELIVERED"
  | "INVENTORY_TRANSFER_DELAYED"
  | "INVENTORY_CYCLE_COUNT_DUE"
  | "INVENTORY_VARIANCE"
  | "INVENTORY_EXPIRED_CONSUMABLES"
  | "PM_INTELLIGENCE_ALERT"
  | "METER_COUNT_MISSING"
  | "METER_RESET_SUSPECTED"
  | "UNUSUAL_METER_INCREASE"
  | "MACHINE_HEALTH_DECLINED"
  | "APPROVAL_SUBMITTED"
  | "APPROVAL_ASSIGNED"
  | "APPROVAL_APPROVED"
  | "APPROVAL_REJECTED"
  | "APPROVAL_RETURNED"
  | "APPROVAL_RESUBMITTED"
  | "APPROVAL_ESCALATED"
  | "APPROVAL_DELEGATED"
  | "APPROVAL_COMMENTED"
  | "APPROVAL_CANCELLED"
  | "APPROVAL_OVERDUE"
  | "APPROVAL_CRITICAL"
  | "DATA_QUALITY_CRITICAL"
  | "DATA_QUALITY_SCAN_COMPLETED"
  | "DATA_QUALITY_SCAN_FAILED"
  | "DATA_QUALITY_ISSUE_ASSIGNED"
  | "DATA_QUALITY_ISSUE_OVERDUE"
  | "DATA_QUALITY_ISSUE_RESOLVED"
  | "DATA_QUALITY_ISSUE_REOPENED"
  | "DATA_QUALITY_MERGE_COMPLETED"
  | "DATA_QUALITY_MERGE_FAILED"
  | "DATA_QUALITY_BULK_CLEANUP"
  | "DATA_QUALITY_HEALTH_CRITICAL"
  | "AI_CRITICAL_INSIGHT"
  | "AI_INSIGHT_ASSIGNED"
  | "AI_INSIGHT_RESTORED"
  | "AI_ANALYSIS_FAILED"
  | "AI_DATA_STALE"
  | "AI_SERVICE_UNAVAILABLE";

export type NotificationPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type MatrixNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  printerId: string | null;
  printerName: string | null;
  customerName: string | null;
  /** Target user display names / ids (dev session uses names). */
  userIds: string[];
  createdAt: string;
  readAt: string | null;
  priority: NotificationPriority;
  relatedRecordType: string | null;
  relatedRecordId: string | null;
};

export type NotificationFilterState = {
  unreadOnly: boolean;
  priority: NotificationPriority | "ALL";
  maintenanceType: NotificationType | "ALL";
  customer: string;
  dateFrom: string;
  dateTo: string;
};

/** Reminder thresholds — editable admin setup values. */
export type ReminderThresholdConfig = {
  id: string;
  label: string;
  /** Copies before due for PM due-soon reminders */
  pmDueSoonCopies: number;
  /** Copies before due for cleaning due-soon reminders */
  cleaningDueSoonCopies: number;
  /** Treat as due today when remaining copies <= this */
  dueTodayCopies: number;
  /** Overdue band 1 */
  overdueBand1Copies: number;
  /** Overdue band 2 */
  overdueBand2Copies: number;
  notes: string;
  updatedAt: string;
  updatedBy: string;
};

/**
 * Channel preferences — email/SMS flags reserved for later patches.
 * Do not remove; keep data model stable when channels are wired.
 */
export type NotificationPreferences = {
  userId: string;
  inAppEnabled: boolean;
  dailySummaryEnabled: boolean;
  weeklySummaryEnabled: boolean;
  /** Reserved — not delivered yet */
  emailEnabled: boolean;
  /** Reserved — not delivered yet */
  smsEnabled: boolean;
  updatedAt: string;
};

export type PredictionConfidence = "High" | "Medium" | "Low";

export type MaintenancePrediction = {
  kind: "PM" | "CLEANING" | "JOINT_UNIT" | "DTF_PM";
  label: string;
  estimatedDate: string | null;
  estimatedDays: number | null;
  copiesRemaining: number | null;
  confidence: PredictionConfidence;
  explanation: string;
};

export type PrinterHealthIndicators = {
  printerId: string;
  overallHealthScore: number;
  maintenanceCompliance: number;
  serviceHistoryScore: number;
  openIssues: number;
  recentRepairs: number;
  copyVolumeTrend: "Rising" | "Stable" | "Falling" | "Unknown";
  band: "Excellent" | "Good" | "Fair" | "Poor";
};

export type MaintenanceRecommendation = {
  kind: "PM" | "CLEANING" | "JOINT_UNIT" | "DTF_PM";
  label: string;
  recommended: boolean;
  urgency: NotificationPriority;
  explanation: string;
};

export type TechnicianTask = {
  id: string;
  printerId: string;
  printerName: string;
  customerName: string;
  siteName: string;
  address: string;
  taskType: "PM" | "CLEANING" | "JOINT_UNIT" | "DTF_PM" | "SETUP";
  priority: NotificationPriority;
  estimatedDurationHours: number;
  dueStatus: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "RESCHEDULED";
  notes: string;
  scheduledDate: string | null;
};

export type GroupedVisitRecommendation = {
  id: string;
  customerName: string;
  siteName: string;
  address: string;
  printerIds: string[];
  printerNames: string[];
  taskTypes: string[];
  estimatedDurationHours: number;
  savingsNote: string;
  priority: NotificationPriority;
};

export type DashboardAlertWidget = {
  id: string;
  title: string;
  count: number;
  description: string;
  accent: string;
  items: Array<{ id: string; label: string; detail: string }>;
};

export const DEFAULT_REMINDER_THRESHOLDS: ReminderThresholdConfig = {
  id: "reminder-defaults",
  label: "Editable setup defaults",
  pmDueSoonCopies: 100_000,
  cleaningDueSoonCopies: 50_000,
  dueTodayCopies: 0,
  overdueBand1Copies: 50_000,
  overdueBand2Copies: 100_000,
  notes:
    "Placeholder reminder thresholds — administrators can edit these values.",
  updatedAt: new Date(0).toISOString(),
  updatedBy: "system",
};

export function defaultNotificationFilters(): NotificationFilterState {
  return {
    unreadOnly: false,
    priority: "ALL",
    maintenanceType: "ALL",
    customer: "",
    dateFrom: "",
    dateTo: "",
  };
}

export function defaultNotificationPreferences(
  userId: string,
): NotificationPreferences {
  return {
    userId,
    inAppEnabled: true,
    dailySummaryEnabled: true,
    weeklySummaryEnabled: false,
    emailEnabled: false,
    smsEnabled: false,
    updatedAt: new Date().toISOString(),
  };
}
