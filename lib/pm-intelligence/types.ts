/**
 * PM Intelligence — meter counts, forecasting, cleanings, compliance (Patch 44).
 * Extends Patches 33–36 maintenance; does not replace lib/maintenance.
 */

export type PmIntelligenceStatus =
  | "Healthy"
  | "Monitor"
  | "Due Soon"
  | "Due"
  | "Critical"
  | "Overdue"
  | "Severely Overdue"
  | "Scheduled"
  | "In Progress"
  | "Awaiting Parts"
  | "Completed"
  | "Deferred"
  | "Not Enough Data"
  | "Inactive Machine";

export type CleaningTypeId =
  | "DTF"
  | "JOINT_UNIT"
  | "INK_PATH"
  | "TRANSFER"
  | "SCANNER"
  | "FEEDER"
  | "PAPER_PATH"
  | "PRINTHEAD"
  | "GENERAL"
  | "CUSTOM";

export type CleaningStatus =
  | "Current"
  | "Due Soon"
  | "Due"
  | "Overdue"
  | "Scheduled"
  | "Completed"
  | "Deferred"
  | "Not Applicable";

export type MeterCountSource =
  | "Manual Entry"
  | "Technician Visit"
  | "Customer Submission"
  | "Remote Monitoring"
  | "CSV Import"
  | "API Integration"
  | "Work Order"
  | "PM Completion";

export type ForecastConfidence = "High Confidence" | "Moderate Confidence" | "Low Confidence";

export type ForecastWindow =
  | "7d"
  | "14d"
  | "30d"
  | "60d"
  | "90d"
  | "6m"
  | "12m"
  | "custom";

export type PmIntervalRule = {
  id: string;
  name: string;
  printerModel: string;
  maintenanceType: "Standard PM" | "Major PM" | "Inspection";
  startingMeter: number;
  intervalCount: number;
  warningThreshold: number;
  criticalThreshold: number;
  graceThreshold: number;
  dateBasedIntervalDays: number | null;
  requiredPartsKitId: string | null;
  estimatedLaborHours: number;
  instructions: string;
  active: boolean;
};

export type MeterReading = {
  id: string;
  printerId: string;
  meterCount: number;
  previousCount: number | null;
  countIncrease: number | null;
  recordedAt: string;
  countTime: string;
  operatingHours: number | null;
  colorCount: number | null;
  blackCount: number | null;
  duplexCount: number | null;
  scanCount: number | null;
  notes: string;
  source: MeterCountSource;
  enteredBy: string;
  photoUrl: string | null;
  validationOverrideReason: string | null;
  suspectedReset: boolean;
  unusualIncrease: boolean;
};

export type MeterImportBatch = {
  id: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
};

export type CleaningIntervalRule = {
  id: string;
  cleaningType: CleaningTypeId;
  label: string;
  printerModel: string | null;
  impressionInterval: number | null;
  calendarIntervalDays: number | null;
  operatingHoursInterval: number | null;
  warningThreshold: number;
  active: boolean;
};

export type CleaningScheduleRow = {
  id: string;
  printerId: string;
  customerName: string;
  siteName: string;
  machineName: string;
  printerModel: string;
  cleaningType: CleaningTypeId;
  cleaningLabel: string;
  lastCleaningCount: number | null;
  lastCleaningDate: string | null;
  currentMeter: number | null;
  nextCleaningCount: number | null;
  nextCleaningDate: string | null;
  remainingCount: number | null;
  daysRemaining: number | null;
  assignedTechnician: string | null;
  status: CleaningStatus;
  notes: string;
};

export type CleaningCompletion = {
  id: string;
  printerId: string;
  cleaningType: CleaningTypeId;
  completedAt: string;
  completedMeter: number;
  technician: string;
  timeSpentMinutes: number;
  conditionBefore: string;
  conditionAfter: string;
  suppliesUsed: string[];
  partsUsed: string[];
  photos: string[];
  notes: string;
  customerSignature: string | null;
  followUpRequired: boolean;
  nextCleaningCount: number | null;
  nextCleaningDate: string | null;
};

export type MachineHealthFactor = {
  key: string;
  label: string;
  impact: number;
  detail: string;
};

export type MachineHealthScore = {
  printerId: string;
  score: number;
  label: "Excellent" | "Healthy" | "Attention Needed" | "High Risk" | "Critical";
  factors: MachineHealthFactor[];
  calculatedAt: string;
};

export type PmForecastItem = {
  printerId: string;
  machineName: string;
  customerName: string;
  siteName: string;
  printerModel: string;
  kind: "PM" | "DTF" | "JOINT_UNIT" | "CLEANING";
  estimatedDate: string | null;
  estimatedMeter: number | null;
  confidence: ForecastConfidence;
  estimatedLaborHours: number;
  partsKitId: string | null;
  reason: string;
};

export type PmForecastSummary = {
  window: ForecastWindow;
  windowLabel: string;
  machinesReachingPm: number;
  expectedDtfCleanings: number;
  expectedJointCleanings: number;
  estimatedLaborHours: number;
  estimatedPartsDemand: string[];
  workloadByTechnician: Array<{ technician: string; hours: number; jobs: number }>;
  workloadByCustomer: Array<{ customer: string; jobs: number }>;
  workloadByModel: Array<{ model: string; jobs: number }>;
  partsShortageRisks: string[];
  items: PmForecastItem[];
};

export type PmDashboardMetrics = {
  totalActiveMachines: number;
  machinesCurrentOnPm: number;
  pmsDueSoon: number;
  pmsDueNow: number;
  overduePms: number;
  dtfCleaningsDue: number;
  jointUnitCleaningsDue: number;
  meterUpdatesNeeded: number;
  pmCompliancePercent: number;
  estimatedPmsNext30Days: number;
};

export type MeterTableRow = {
  printerId: string;
  customerName: string;
  siteName: string;
  machineName: string;
  assetNumber: string;
  serialNumber: string;
  printerModel: string;
  currentMeter: number | null;
  previousMeter: number | null;
  countIncrease: number | null;
  avgDailyVolume: number | null;
  avgMonthlyVolume: number | null;
  lastCountDate: string | null;
  countSource: MeterCountSource | null;
  enteredBy: string | null;
  nextPmCount: number | null;
  impressionsRemaining: number | null;
  estimatedPmDate: string | null;
  pmStatus: PmIntelligenceStatus;
  cleaningStatus: CleaningStatus;
};

export type PmScheduleRow = {
  id: string;
  scheduledDate: string;
  customerName: string;
  siteName: string;
  machineName: string;
  printerId: string;
  printerModel: string;
  currentCount: number | null;
  pmDueCount: number | null;
  remainingOrOverdue: number | null;
  estimatedLaborHours: number;
  assignedTechnician: string | null;
  requiredParts: string[];
  partsAvailability: "Available" | "Partial" | "Missing" | "Unknown";
  workOrderId: string | null;
  status: PmIntelligenceStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
};

export type PmHistoryRow = {
  id: string;
  completionDate: string;
  customerName: string;
  siteName: string;
  machineName: string;
  serialNumber: string;
  printerModel: string;
  pmType: string;
  meterCount: number;
  technician: string;
  laborMinutes: number;
  partsUsed: string[];
  cleaningPerformed: boolean;
  workOrderNumber: string | null;
  result: string;
  followUpRequired: boolean;
  reportId: string | null;
};

export type PmPartsKit = {
  id: string;
  name: string;
  printerModel: string;
  requiredParts: Array<{ partNumber: string; description: string; quantity: number }>;
  recommendedParts: Array<{ partNumber: string; description: string; quantity: number }>;
  consumables: Array<{ partNumber: string; description: string; quantity: number }>;
  estimatedLaborHours: number;
};

export type PmChecklistItem = {
  id: string;
  taskName: string;
  description: string;
  required: boolean;
  recommended: boolean;
  photoRequired: boolean;
  completionStatus: "PENDING" | "DONE" | "NA" | "FAIL";
  technicianNotes: string;
  measurement: string;
  passFail: "PASS" | "FAIL" | null;
  followUpRequired: boolean;
};

export type PmCompletionSession = {
  id: string;
  printerId: string;
  scheduleId: string | null;
  step: number;
  startingMeter: number | null;
  endingMeter: number | null;
  checklist: PmChecklistItem[];
  partsUsed: Array<{ partNumber: string; quantity: number }>;
  cleaningTypes: CleaningTypeId[];
  notes: string;
  photos: string[];
  technician: string;
  customerAck: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  startedAt: string;
  completedAt: string | null;
};

export type PmAuditEntry = {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  printerId: string | null;
  customerName: string | null;
  previousValue: string | null;
  newValue: string | null;
  reason: string | null;
  sourceModule: string;
  device: string;
  ipAddress: string;
  workOrderId: string | null;
  pmEventId: string | null;
};

export type PmIntelligenceFilters = {
  customer: string;
  site: string;
  region: string;
  technician: string;
  printerModel: string;
  dateFrom: string;
  dateTo: string;
  pmStatus: PmIntelligenceStatus | "ALL";
};

export type HealthScoreWeights = {
  pmStatus: number;
  cleaningStatus: number;
  countFreshness: number;
  overdueWork: number;
  usageLevel: number;
};

export type PmSettings = {
  countFreshnessDays: number;
  unusualIncreaseMultiplier: number;
  healthWeights: HealthScoreWeights;
  defaultWarningThreshold: number;
  defaultCriticalThreshold: number;
  defaultGraceThreshold: number;
  customerNotificationsEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
};

export const DEFAULT_PM_SETTINGS: PmSettings = {
  countFreshnessDays: 30,
  unusualIncreaseMultiplier: 3,
  healthWeights: {
    pmStatus: 35,
    cleaningStatus: 20,
    countFreshness: 15,
    overdueWork: 20,
    usageLevel: 10,
  },
  defaultWarningThreshold: 75_000,
  defaultCriticalThreshold: 25_000,
  defaultGraceThreshold: 10_000,
  customerNotificationsEnabled: false,
  updatedAt: "2026-07-13T00:00:00.000Z",
  updatedBy: "system",
};
