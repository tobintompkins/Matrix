/**
 * Mobile Field Experience & Offline Mode (Patch 39).
 */

export type ConnectivityStatus =
  | "ONLINE"
  | "OFFLINE"
  | "UNSTABLE"
  | "SYNCHRONIZING"
  | "SYNC_FAILED";

export type OfflineOpType =
  | "STATUS_CHANGE"
  | "WORK_SESSION"
  | "NOTE"
  | "COPY_COUNT"
  | "TIME_ENTRY"
  | "PARTS_USAGE"
  | "MAINTENANCE_COMPLETION"
  | "PHOTO"
  | "ATTACHMENT"
  | "SIGNATURE"
  | "COMPLETION";

export type OfflineOpStatus =
  | "PENDING"
  | "SYNCHRONIZING"
  | "SYNCHRONIZED"
  | "FAILED"
  | "CONFLICT"
  | "CANCELLED";

export type ConflictResolution =
  | "KEEP_SERVER"
  | "SUBMIT_OFFLINE"
  | "MERGE_NOTES"
  | "SAVE_AS_HISTORY"
  | "ASK_MANAGER";

export type WorkSessionAction =
  | "BEGIN_TRAVEL"
  | "ARRIVE_ON_SITE"
  | "START_WORK"
  | "PAUSE_WORK"
  | "RESUME_WORK"
  | "WAITING_FOR_PARTS"
  | "WAITING_FOR_CUSTOMER"
  | "COMPLETE_WORK";

export type AttachmentCategory =
  | "BEFORE_REPAIR"
  | "AFTER_REPAIR"
  | "DAMAGED_PART"
  | "PRINTER_COUNTER"
  | "SERIAL_NUMBER"
  | "ERROR_SCREEN"
  | "INSTALLATION"
  | "CUSTOMER_DOCUMENT"
  | "OTHER";

export type FieldWorkFilter =
  | "TODAY"
  | "TOMORROW"
  | "THIS_WEEK"
  | "OVERDUE"
  | "CRITICAL"
  | "WAITING_FOR_PARTS"
  | "COMPLETED"
  | "DOWNLOADED";

export type OfflineOperation = {
  /** Client-generated idempotency key (also IndexedDB keyPath) */
  id: string;
  operationId: string;
  type: OfflineOpType;
  status: OfflineOpStatus;
  userId: string;
  technicianName: string;
  workOrderId: string | null;
  printerId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  lastError: string | null;
  conflictStatus: string | null;
  dependsOn: string[];
  synchronizedAt: string | null;
};

export type OfflinePackage = {
  id: string;
  workOrderId: string;
  workOrderNumber: string;
  downloadedAt: string;
  expiresAt: string | null;
  sizeBytes: number;
  readiness: "READY" | "STALE" | "INCOMPLETE";
  technicianId: string;
  snapshot: OfflinePackageSnapshot;
};

export type OfflinePackageSnapshot = {
  workOrder: Record<string, unknown>;
  customer: Record<string, unknown>;
  site: Record<string, unknown>;
  printer: Record<string, unknown>;
  serviceHistory: Record<string, unknown>[];
  maintenanceStatus: Record<string, unknown>;
  requiredParts: Record<string, unknown>[];
  truckStock: Record<string, unknown>[];
  notes: Record<string, unknown>[];
  diagramRefs: string[];
  documentRefs: string[];
  serverRevision: string;
};

export type WorkSession = {
  id: string;
  workOrderId: string;
  technicianId: string;
  technicianName: string;
  active: boolean;
  events: WorkSessionEvent[];
  travelStartedAt: string | null;
  arrivedAt: string | null;
  workStartedAt: string | null;
  completedAt: string | null;
  totalTravelMs: number;
  totalLaborMs: number;
  totalPausedMs: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkSessionEvent = {
  id: string;
  action: WorkSessionAction;
  occurredAt: string;
  reason: string | null;
};

export type SyncConflict = {
  id: string;
  operationId: string;
  entityType: string;
  entityId: string;
  field: string;
  offlineValue: string;
  serverValue: string;
  offlineChangedAt: string;
  serverChangedAt: string;
  serverChangedBy: string;
  recommended: ConflictResolution;
  status: "OPEN" | "RESOLVED";
  resolution: ConflictResolution | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
};

export type SyncAttempt = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
  errors: string[];
};

export type FieldAuditEntry = {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  operationId: string | null;
  previousValue: string | null;
  newValue: string | null;
  syncStatus: string | null;
  error: string | null;
  deviceId: string | null;
  occurredAt: string;
};

export type PendingAttachment = {
  id: string;
  operationId: string;
  workOrderId: string;
  category: AttachmentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  /** Base64 or object URL reference stored offline */
  dataRef: string;
  createdAt: string;
  uploaded: boolean;
};

export type FieldHomeMetrics = {
  technicianName: string;
  dateLabel: string;
  connectivity: ConnectivityStatus;
  scheduledToday: number;
  overdue: number;
  critical: number;
  waitingForParts: number;
  pmsDueSoon: number;
  recentlyCompleted: number;
  unsyncedChanges: number;
};

export type CompletionChecklist = {
  workDocumented: boolean;
  resolutionEntered: boolean;
  copyCountEntered: boolean;
  maintenanceChecklistDone: boolean;
  partsRecorded: boolean;
  laborPresent: boolean;
  photosAttached: boolean;
  signatureOrDecline: boolean;
  followUpRecorded: boolean;
  unsyncedVisible: boolean;
  ready: boolean;
  missing: string[];
};

export type FieldStorageStats = {
  downloadedPackages: number;
  pendingOps: number;
  pendingAttachmentBytes: number;
  estimatedBytes: number;
  lastSuccessfulSync: string | null;
  lastFullRefresh: string | null;
};

/** Actions that require a reason before recording. */
export const SESSION_ACTIONS_REQUIRING_REASON: WorkSessionAction[] = [
  "PAUSE_WORK",
  "WAITING_FOR_PARTS",
  "WAITING_FOR_CUSTOMER",
];

export const SYNC_ORDER: OfflineOpType[] = [
  "WORK_SESSION",
  "STATUS_CHANGE",
  "NOTE",
  "COPY_COUNT",
  "TIME_ENTRY",
  "MAINTENANCE_COMPLETION",
  "PARTS_USAGE",
  "PHOTO",
  "ATTACHMENT",
  "SIGNATURE",
  "COMPLETION",
];
