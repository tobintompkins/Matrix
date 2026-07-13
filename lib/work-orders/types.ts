/**
 * Enterprise Work Order Management (Patch 37).
 * Central workflow for service tickets, PMs, repairs, installs, and visits.
 * Coexists with lib/service-calls — does not replace it.
 */

export type WorkOrderServiceType =
  | "BREAK_FIX"
  | "PREVENTIVE_MAINTENANCE"
  | "CLEANING"
  | "JOINT_UNIT"
  | "DTF_PM"
  | "INSTALLATION"
  | "DELIVERY"
  | "TRAINING"
  | "NETWORK_SUPPORT"
  | "FIRMWARE_UPDATE"
  | "INSPECTION"
  | "PARTS_DELIVERY"
  | "REMOTE_SUPPORT"
  | "WARRANTY"
  | "OTHER";

export type WorkOrderStatus =
  | "DRAFT"
  | "NEW"
  | "ASSIGNED"
  | "SCHEDULED"
  | "TRAVELING"
  | "ON_SITE"
  | "WAITING_FOR_PARTS"
  | "WAITING_FOR_CUSTOMER"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED"
  | "CLOSED";

export type WorkOrderPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW";

export type WorkOrderSource =
  | "CUSTOMER_REQUEST"
  | "DISPATCH"
  | "MAINTENANCE_PLAN"
  | "TECHNICIAN"
  | "INTERNAL"
  | "OTHER";

export type WorkOrderTimelineEventType =
  | "CREATED"
  | "ASSIGNED"
  | "STATUS_CHANGED"
  | "NOTE_ADDED"
  | "PHOTO_UPLOADED"
  | "FILE_UPLOADED"
  | "SIGNATURE_CAPTURED"
  | "PART_ADDED"
  | "LABOR_UPDATED"
  | "TRAVEL_UPDATED"
  | "COPY_COUNT_RECORDED"
  | "COMPLETED"
  | "FIELD_CHANGED";

export type WorkOrderAttachmentKind =
  | "PHOTO"
  | "PDF"
  | "SERVICE_DOCUMENT"
  | "CONFIGURATION_FILE"
  | "OTHER";

export type WorkOrderAttachment = {
  id: string;
  workOrderId: string;
  kind: WorkOrderAttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  notes: string;
  /** Dev placeholder URL / data reference — not a live blob store yet */
  storageRef: string;
};

export type WorkOrderPartLine = {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
  source: string;
  addedBy: string;
  addedAt: string;
};

export type WorkOrderTimelineEvent = {
  id: string;
  workOrderId: string;
  type: WorkOrderTimelineEventType;
  title: string;
  description: string;
  actor: string;
  occurredAt: string;
  previousValue?: string | null;
  newValue?: string | null;
};

export type WorkOrderAuditEntry = {
  id: string;
  workOrderId: string;
  field: string;
  previousValue: string;
  newValue: string;
  actor: string;
  occurredAt: string;
  action: string;
};

export type PriorityConfig = {
  priority: WorkOrderPriority;
  label: string;
  color: string;
  /** SLA target hours — editable admin setup */
  slaHours: number;
};

export type ServiceTypeConfig = {
  code: WorkOrderServiceType | string;
  label: string;
  active: boolean;
  /** Admin-extensible catalog */
  system: boolean;
};

export type WorkOrder = {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string;
  customerId: string;
  customerName: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  region: string;
  printerId: string | null;
  printerName: string | null;
  printerModel: string | null;
  assetTag: string | null;
  serviceType: WorkOrderServiceType | string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  source: WorkOrderSource;
  assignedTechnician: string;
  secondaryTechnician: string;
  requestedBy: string;
  createdBy: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  completedDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  travelTime: number | null;
  mileage: number | null;
  laborRate: number | null;
  laborCost: number | null;
  notes: string;
  internalNotes: string;
  customerVisibleNotes: string;
  customerSignature: string | null;
  signatureCapturedAt: string | null;
  signatureCapturedBy: string | null;
  copyCountAtStart: number | null;
  copyCountAtEnd: number | null;
  parts: WorkOrderPartLine[];
  attachments: WorkOrderAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkOrderInput = {
  title: string;
  description: string;
  customerId?: string;
  customerName: string;
  siteId?: string;
  siteName: string;
  siteAddress?: string;
  region?: string;
  printerId?: string | null;
  printerName?: string | null;
  printerModel?: string | null;
  assetTag?: string | null;
  serviceType: WorkOrderServiceType | string;
  priority: WorkOrderPriority;
  source?: WorkOrderSource;
  assignedTechnician?: string;
  secondaryTechnician?: string;
  requestedBy?: string;
  createdBy: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  estimatedHours?: number | null;
  notes?: string;
  internalNotes?: string;
  customerVisibleNotes?: string;
  asDraft?: boolean;
};

export type WorkOrderFilterState = {
  search: string;
  status: WorkOrderStatus | "ALL";
  customer: string;
  technician: string;
  serviceType: string;
  priority: WorkOrderPriority | "ALL";
  dateFrom: string;
  dateTo: string;
  region: string;
  printerModel: string;
  site: string;
  onlyMine: boolean;
  currentUser: string;
  sort: "updated" | "priority" | "scheduled" | "number";
  sortDir: "asc" | "desc";
};

export type WorkOrderDashboardMetrics = {
  open: number;
  scheduledToday: number;
  overdue: number;
  waitingForParts: number;
  completedToday: number;
  averageCompletionHours: number | null;
  critical: number;
};

export const DEFAULT_PRIORITY_CONFIGS: PriorityConfig[] = [
  {
    priority: "CRITICAL",
    label: "Critical",
    color: "#fb7185",
    slaHours: 4,
  },
  {
    priority: "HIGH",
    label: "High",
    color: "#fb923c",
    slaHours: 8,
  },
  {
    priority: "NORMAL",
    label: "Normal",
    color: "#22d3ee",
    slaHours: 24,
  },
  {
    priority: "LOW",
    label: "Low",
    color: "#94a3b8",
    slaHours: 72,
  },
];

export const DEFAULT_SERVICE_TYPE_CONFIGS: ServiceTypeConfig[] = [
  { code: "BREAK_FIX", label: "Break/Fix", active: true, system: true },
  {
    code: "PREVENTIVE_MAINTENANCE",
    label: "Preventive Maintenance",
    active: true,
    system: true,
  },
  { code: "CLEANING", label: "Cleaning", active: true, system: true },
  { code: "JOINT_UNIT", label: "Joint Unit", active: true, system: true },
  { code: "DTF_PM", label: "DTF PM", active: true, system: true },
  { code: "INSTALLATION", label: "Installation", active: true, system: true },
  { code: "DELIVERY", label: "Delivery", active: true, system: true },
  { code: "TRAINING", label: "Training", active: true, system: true },
  {
    code: "NETWORK_SUPPORT",
    label: "Network Support",
    active: true,
    system: true,
  },
  {
    code: "FIRMWARE_UPDATE",
    label: "Firmware Update",
    active: true,
    system: true,
  },
  { code: "INSPECTION", label: "Inspection", active: true, system: true },
  {
    code: "PARTS_DELIVERY",
    label: "Parts Delivery",
    active: true,
    system: true,
  },
  {
    code: "REMOTE_SUPPORT",
    label: "Remote Support",
    active: true,
    system: true,
  },
  { code: "WARRANTY", label: "Warranty", active: true, system: true },
  { code: "OTHER", label: "Other", active: true, system: true },
];
