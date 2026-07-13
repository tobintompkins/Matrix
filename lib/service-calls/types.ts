/**
 * Service Call / Work Order foundation types.
 *
 * Future live integrations (placeholders — not wired yet):
 * - Real database persistence
 * - Dispatch notifications
 * - Email / SMS alerts
 * - GPS technician routing
 * - Customer portal updates
 * - Remote monitoring alerts
 * - SLA tracking
 * - Labor billing
 * - Customer / technician signatures
 * - Photo uploads
 */

export type ServiceCallStatus =
  | "NEW"
  | "UNASSIGNED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "ON_SITE"
  | "DIAGNOSING"
  | "WAITING_FOR_PARTS"
  | "WAITING_FOR_CUSTOMER"
  | "ESCALATED"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export type ServiceCallPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "URGENT"
  | "EMERGENCY"
  | "CRITICAL";

export type ServiceCallType =
  | "BREAK_FIX"
  | "PREVENTIVE_MAINTENANCE"
  | "INSTALLATION"
  | "NETWORK_SUPPORT"
  | "OPERATOR_TRAINING"
  | "INSPECTION"
  | "REMOTE_SUPPORT"
  | "FOLLOW_UP"
  | "OTHER";

export type ServiceCallNoteType =
  | "GENERAL"
  | "DIAGNOSIS"
  | "CUSTOMER_CONTACT"
  | "PARTS"
  | "ESCALATION"
  | "FOLLOW_UP";

export type ServiceCallActivityType =
  | "CALL_CREATED"
  | "CALL_ASSIGNED"
  | "STATUS_CHANGED"
  | "TECHNICIAN_ACCEPTED"
  | "TRAVEL_STARTED"
  | "ARRIVED_ON_SITE"
  | "NOTE_ADDED"
  | "DIAGNOSIS_ADDED"
  | "PART_ADDED"
  | "PART_ORDERED"
  | "WAITING_FOR_PARTS"
  | "CUSTOMER_CONTACTED"
  | "CALL_RESOLVED"
  | "CALL_CLOSED"
  | "CALL_REOPENED";

export type FinalMachineStatus =
  | "OPERATIONAL"
  | "OPERATIONAL_WITH_LIMITATIONS"
  | "WAITING_FOR_PARTS"
  | "DOWN"
  | "REQUIRES_FOLLOW_UP";

export type PartOrderStatus =
  | "NOT_ORDERED"
  | "DRAFT"
  | "ORDERED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "INSTALLED"
  | "CANCELLED";

export type PartStockSource = "truck" | "warehouse" | "ordered" | "unknown";

export type ServiceCallMachineSnapshot = {
  machineId: string;
  assetTag: string;
  serialNumber: string;
  printerModel: string;
  nickname: string;
  customerName: string;
  siteName: string;
  machineLocation: string;
  currentMeterCount: number;
  organization: string;
  region: string;
};

export type ServiceCallContact = {
  reportedBy: string;
  reporterPhone: string;
  reporterEmail: string;
  customerContactName: string;
};

export type ServiceCallAssignment = {
  technician: string;
  serviceManager: string;
  organization: string;
  region: string;
  warehouse: string;
  truck: string;
};

export type ServiceCallSchedule = {
  requestedServiceDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  arrivalDateTime: string;
  departureDateTime: string;
  estimatedDurationHours: number;
  actualLaborHours: number;
};

export type ServiceCallPart = {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  required: boolean;
  used: boolean;
  ordered: boolean;
  orderStatus: PartOrderStatus;
  emergency: boolean;
  stockSource: PartStockSource;
  notes?: string;
};

export type ServiceCallNote = {
  id: string;
  author: string;
  createdAt: string;
  noteType: ServiceCallNoteType;
  body: string;
  internalOnly: boolean;
};

export type ServiceCallActivity = {
  id: string;
  serviceCallId: string;
  activityType: ServiceCallActivityType;
  description: string;
  user: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
};

export type ServiceCallAttachment = {
  id: string;
  label: string;
  kind: "photo" | "document" | "signature" | "other";
  description: string;
  /** Placeholder — uploads not connected yet */
  placeholder: true;
};

export type ServiceCallResolution = {
  diagnosis: string;
  rootCause: string;
  workPerformed: string;
  resolutionSummary: string;
  finalMachineStatus: FinalMachineStatus | "";
  technicianRecommendations: string;
  followUpRequired: boolean;
  followUpDate: string;
  technicianName: string;
  completedAt: string;
};

export type ServiceCallCustomerConfirmation = {
  customerContactName: string;
  customerSignaturePlaceholder: string;
  technicianSignaturePlaceholder: string;
  completionAcknowledged: boolean;
  managerOverrideClose: boolean;
  satisfactionRating: number | null;
  customerComments: string;
};

export type ServiceCallProblem = {
  issueTitle: string;
  problemDescription: string;
  errorCode: string;
  symptoms: string;
  customerImpact: string;
  machineOperationalStatus: string;
  machineCurrentlyDown: boolean;
};

export type ServiceCall = {
  id: string;
  workOrderNumber: string;
  ticketNumber: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  closedAt: string;
  status: ServiceCallStatus;
  priority: ServiceCallPriority;
  serviceType: ServiceCallType;
  machine: ServiceCallMachineSnapshot;
  problem: ServiceCallProblem;
  contact: ServiceCallContact;
  assignment: ServiceCallAssignment;
  schedule: ServiceCallSchedule;
  resolution: ServiceCallResolution;
  parts: ServiceCallPart[];
  notes: ServiceCallNote[];
  activity: ServiceCallActivity[];
  attachments: ServiceCallAttachment[];
  customerConfirmation: ServiceCallCustomerConfirmation;
  isDraft: boolean;
};

export type ServiceCallSortKey =
  | "newest"
  | "oldest"
  | "priority"
  | "scheduled"
  | "customer"
  | "technician"
  | "status";

export type ServiceCallViewMode = "table" | "card" | "board";

export type ServiceCallFilterState = {
  search: string;
  status: ServiceCallStatus | "ALL";
  priority: ServiceCallPriority | "ALL";
  serviceType: ServiceCallType | "ALL";
  printerModel: string;
  technician: string;
  customerSite: string;
  organization: string;
  dateFrom: string;
  dateTo: string;
  sort: ServiceCallSortKey;
  view: ServiceCallViewMode;
};

export type ServiceCallDashboardMetrics = {
  totalOpen: number;
  newCalls: number;
  unassigned: number;
  assigned: number;
  emergency: number;
  waitingForParts: number;
  dueToday: number;
  overdue: number;
  closedThisWeek: number;
};

export type CreateServiceCallInput = {
  machineId: string;
  serviceType: ServiceCallType;
  issueTitle: string;
  problemDescription: string;
  errorCode: string;
  symptoms: string;
  customerImpact: string;
  machineCurrentlyDown: boolean;
  priority: ServiceCallPriority;
  reportedBy: string;
  reporterPhone: string;
  reporterEmail: string;
  technician: string;
  serviceManager: string;
  organization: string;
  region: string;
  requestedServiceDate: string;
  scheduledStart: string;
  estimatedDurationHours: number;
  isDraft: boolean;
  createdBy: string;
};

export type ServiceCallIntegrationPlaceholders = {
  realDatabasePersistence: "pending";
  dispatchNotifications: "pending";
  emailSmsAlerts: "pending";
  gpsTechnicianRouting: "pending";
  customerPortalUpdates: "pending";
  remoteMonitoringAlerts: "pending";
  slaTracking: "pending";
  laborBilling: "pending";
  customerSignatures: "pending";
  technicianSignatures: "pending";
  photoUploads: "pending";
};
