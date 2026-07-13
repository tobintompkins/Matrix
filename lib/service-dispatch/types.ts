/**
 * Patch 41 — Enterprise Service Ticket & Dispatch Center types.
 * Extends service-calls with SLA, dispatch, diagnostics, labor, and reports.
 */

export type ProblemCategoryCode =
  | "PAPER_JAM"
  | "PRINT_QUALITY"
  | "INK_ISSUE"
  | "PAPER_FEED"
  | "SCANNER_ISSUE"
  | "NETWORK_ISSUE"
  | "SOFTWARE_ISSUE"
  | "FINISHER_ISSUE"
  | "HIGH_CAPACITY_FEEDER"
  | "ERROR_CODE"
  | "POWER_ISSUE"
  | "PREVENTIVE_MAINTENANCE"
  | "INSTALLATION"
  | "TRAINING_REQUEST"
  | "PARTS_REQUEST"
  | "RELOCATION"
  | "INSPECTION"
  | "OTHER";

export type ProblemCategory = {
  id: string;
  code: ProblemCategoryCode | string;
  label: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
};

export type DispatchTicketStatus =
  | "NEW"
  | "AWAITING_REVIEW"
  | "UNASSIGNED"
  | "ASSIGNED"
  | "TECHNICIAN_NOTIFIED"
  | "ACCEPTED"
  | "SCHEDULED"
  | "TRAVELING"
  | "ON_SITE"
  | "DIAGNOSIS"
  | "WAITING_FOR_PARTS"
  | "REPAIR_IN_PROGRESS"
  | "TESTING"
  | "CUSTOMER_REVIEW"
  | "FOLLOW_UP_REQUIRED"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED"
  | "REOPENED"
  /** Legacy aliases kept for existing service-call records */
  | "EN_ROUTE"
  | "DIAGNOSING"
  | "WAITING_FOR_CUSTOMER"
  | "ESCALATED";

export type DispatchPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type TicketSource =
  | "DASHBOARD"
  | "PRINTER"
  | "CUSTOMER"
  | "LOCATION"
  | "PM"
  | "FIELD"
  | "CUSTOMER_PORTAL"
  | "REMOTE_MONITOR"
  | "MANUAL";

export type TechnicianAvailabilityStatus =
  | "AVAILABLE"
  | "ASSIGNED"
  | "TRAVELING"
  | "ON_SITE"
  | "BREAK"
  | "TRAINING"
  | "OUT_OF_OFFICE"
  | "OFF_DUTY";

export type DispatchAssignmentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "REASSIGNED"
  | "COMPLETED"
  | "CANCELLED";

export type LaborType =
  | "TRAVEL"
  | "DIAGNOSIS"
  | "REPAIR"
  | "TESTING"
  | "TRAINING"
  | "REMOTE"
  | "OTHER";

export type SlaState = "OK" | "WARNING" | "AT_RISK" | "BREACHED";

export type EscalationLevel = 0 | 1 | 2 | 3 | 4;

export type DiagnosticRecord = {
  reportedSymptom: string;
  confirmedSymptom: string;
  errorCode: string;
  rootCause: string;
  diagnosticSteps: string;
  componentsInspected: string;
  partsTested: string;
  firmwareChecked: string;
  networkTests: string;
  correctiveAction: string;
  testPrintsCompleted: boolean;
  finalOperatingCondition: string;
  additionalRecommendations: string;
  templateId: string | null;
};

export type DiagnosticTemplate = {
  id: string;
  name: string;
  category: string;
  body: DiagnosticRecord;
  createdBy: string;
  updatedAt: string;
};

export type TicketLaborEntry = {
  id: string;
  ticketId: string;
  technicianId: string;
  startTime: string;
  endTime: string | null;
  laborMinutes: number;
  laborType: LaborType;
  notes: string;
  billable: boolean;
};

export type DispatchAssignment = {
  id: string;
  ticketId: string;
  technicianId: string;
  technicianName: string;
  assignedBy: string;
  assignedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string;
  estimatedArrival: string | null;
  actualArrival: string | null;
  dispatchStatus: DispatchAssignmentStatus;
  reassignmentReason: string;
};

export type TicketUpdate = {
  id: string;
  ticketId: string;
  updateType: string;
  previousStatus: string;
  newStatus: string;
  message: string;
  createdBy: string;
  createdAt: string;
  visibleToCustomer: boolean;
  attachmentUrl: string | null;
};

export type TicketAuditEntry = {
  id: string;
  ticketId: string;
  ticketNumber: string;
  action: string;
  field: string;
  previousValue: string;
  newValue: string;
  actor: string;
  occurredAt: string;
  sessionInfo: string;
};

export type TechnicianProfile = {
  id: string;
  name: string;
  status: TechnicianAvailabilityStatus;
  currentTicketId: string | null;
  nextTicketId: string | null;
  dailyTicketCount: number;
  estimatedWorkloadHours: number;
  territory: string;
  certifications: string[];
  supportedModels: string[];
  latitude: number | null;
  longitude: number | null;
  familiarCustomerIds: string[];
  familiarPrinterIds: string[];
};

export type SlaRule = {
  id: string;
  name: string;
  priority: DispatchPriority | "ALL";
  responseMinutes: number;
  assignmentMinutes: number;
  arrivalMinutes: number;
  resolutionMinutes: number;
  escalationMinutes: number;
  weekendCoverage: boolean;
  enabled: boolean;
};

export type SlaSnapshot = {
  ruleId: string;
  responseDeadline: string;
  assignmentDeadline: string;
  arrivalDeadline: string;
  resolutionDeadline: string;
  escalationDeadline: string;
  responseState: SlaState;
  resolutionState: SlaState;
  minutesToResponse: number | null;
  minutesToResolution: number | null;
};

export type DispatchBoardColumn =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "ACTIVE"
  | "WAITING_FOR_PARTS"
  | "CRITICAL"
  | "COMPLETED_TODAY";

export type DispatchBoardFilters = {
  search: string;
  status: string;
  priority: string;
  customer: string;
  location: string;
  technician: string;
  printerModel: string;
  savedFilter: string;
};

export type DispatchDashboardMetrics = {
  newTickets: number;
  unassigned: number;
  critical: number;
  techniciansTraveling: number;
  techniciansOnSite: number;
  waitingForParts: number;
  slaAtRisk: number;
  slaBreached: number;
  resolvedToday: number;
  reopened: number;
  averageResponseMinutes: number | null;
  averageRepairMinutes: number | null;
  firstTimeFixRate: number | null;
};

export type TechnicianRecommendation = {
  technicianId: string;
  technicianName: string;
  score: number;
  reasons: string[];
};

export type RepeatFailureFlag = {
  printerId: string;
  serialNumber: string;
  ticketCount7d: number;
  sameIssue30d: number;
  badge: boolean;
  relatedTicketIds: string[];
  commonCategory: string;
  recommendation: string;
};

export type ServiceReportPayload = {
  ticketNumber: string;
  customer: string;
  location: string;
  printerModel: string;
  serialNumber: string;
  openedAt: string;
  completedAt: string;
  technician: string;
  reportedProblem: string;
  diagnosis: string;
  workPerformed: string;
  partsUsed: Array<{ partNumber: string; description: string; quantity: number }>;
  meterCount: number | null;
  laborMinutes: number;
  travelMinutes: number;
  testResults: string;
  recommendations: string;
  customerSignature: string;
  technicianSignature: string;
  followUp: string;
  warrantyStatus: string;
};

export type CustomerVisibleTicket = {
  ticketNumber: string;
  printer: string;
  problemDescription: string;
  status: string;
  technicianName: string;
  scheduledWindow: string;
  estimatedArrival: string;
  partsDelay: string;
  resolutionSummary: string;
  updates: Array<{ message: string; at: string }>;
};

export type OfflineDraft = {
  ticketId: string;
  notes: string;
  savedAt: string;
  pendingStatus: string | null;
};
