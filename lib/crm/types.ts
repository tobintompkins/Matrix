/**
 * Enterprise Customer, Site & Asset Management (Patch 40).
 */

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";

export type PreferredContactMethod = "EMAIL" | "PHONE" | "MOBILE" | "SMS";

export type AssetStatus =
  | "ACTIVE"
  | "DOWN"
  | "MAINTENANCE"
  | "LOANER"
  | "DECOMMISSIONED"
  | "DISPOSED";

export type LifecycleEventType =
  | "INSTALLED"
  | "RELOCATED"
  | "UPGRADED"
  | "REPAIRED"
  | "PM_COMPLETED"
  | "CLEANING_COMPLETED"
  | "JOINT_UNIT_REPLACEMENT"
  | "DTF_PM"
  | "FIRMWARE_UPDATED"
  | "WARRANTY_REPAIR"
  | "DECOMMISSIONED"
  | "DISPOSED"
  | "SOLD"
  | "LOANER_INSTALLED";

export type WarrantyKind = "MANUFACTURER" | "EXTENDED" | "SERVICE";

export type WarrantyStatus = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "NONE";

export type ContractBillingType =
  | "FLAT"
  | "PER_CLICK"
  | "TIME_AND_MATERIALS"
  | "HYBRID";

export type DocumentCategory =
  | "CONTRACT"
  | "NETWORK_DIAGRAM"
  | "PRINTER_MANUAL"
  | "SITE_MAP"
  | "FLOOR_PLAN"
  | "PHOTO"
  | "CONFIGURATION"
  | "WARRANTY"
  | "OTHER";

export type CrmRecordState = "ACTIVE" | "ARCHIVED" | "DELETED";

export type CrmCustomer = {
  id: string;
  customerNumber: string;
  name: string;
  status: CustomerStatus;
  industry: string;
  parentCustomerId: string | null;
  taxId: string | null;
  billingAddress: string;
  primaryAddress: string;
  notes: string;
  website: string;
  timeZone: string;
  preferredBusinessHours: string;
  createdAt: string;
  updatedAt: string;
  /** Patch 49B — operational lifecycle */
  recordState?: CrmRecordState;
  deletedAt?: string | null;
  deletedByUserId?: string | null;
  deletionReason?: string | null;
  deletionNotes?: string | null;
  archivedAt?: string | null;
  archivedByUserId?: string | null;
  archiveReason?: string | null;
  region?: string | null;
  accountManager?: string | null;
  updatedAtVersion?: number;
};

export type CrmContact = {
  id: string;
  customerId: string;
  name: string;
  jobTitle: string;
  department: string;
  email: string;
  officePhone: string;
  mobilePhone: string;
  preferredContactMethod: PreferredContactMethod;
  emergencyContact: boolean;
  receiveServiceNotifications: boolean;
  receiveMaintenanceReports: boolean;
  isPrimary: boolean;
  notes: string;
};

export type CrmSite = {
  id: string;
  customerId: string;
  siteNumber: string;
  name: string;
  physicalAddress: string;
  latitude: number | null;
  longitude: number | null;
  timeZone: string;
  businessHours: string;
  loadingDockInstructions: string;
  parkingInstructions: string;
  securityProcedures: string;
  buildingAccessInstructions: string;
  afterHoursAccess: string;
  siteNotes: string;
  assignedTechnician: string;
};

export type CrmAsset = {
  id: string;
  customerId: string;
  siteId: string;
  assetNumber: string;
  serialNumber: string;
  model: string;
  firmwareVersion: string;
  controllerVersion: string;
  installDate: string | null;
  warrantyStart: string | null;
  warrantyEnd: string | null;
  purchaseDate: string | null;
  leaseInfo: string;
  ownership: string;
  status: AssetStatus;
  macAddress: string;
  ipAddress: string;
  hostname: string;
  department: string;
  floor: string;
  room: string;
  latitude: number | null;
  longitude: number | null;
  qrLabel: string;
  barcode: string;
  currentCopyCount: number | null;
  monthlyVolume: number | null;
  nickname: string;
  digitalTwinId: string | null;
};

export type AssetRelationshipKind =
  | "CONTROLLER"
  | "ACCESSORY"
  | "FINISHER"
  | "FOLDER"
  | "FEEDER"
  | "EXTERNAL_DEVICE";

export type AssetRelationship = {
  id: string;
  parentAssetId: string;
  childName: string;
  kind: AssetRelationshipKind;
  serialNumber: string;
  notes: string;
};

export type LifecycleEvent = {
  id: string;
  assetId: string;
  type: LifecycleEventType;
  occurredAt: string;
  actor: string;
  summary: string;
  details: string;
};

export type CrmContract = {
  id: string;
  customerId: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  renewalDate: string | null;
  slaResponseHours: number;
  slaResolutionHours: number;
  includedPMs: number;
  includedLaborHours: number;
  includedParts: boolean;
  excludedServices: string;
  billingType: ContractBillingType;
  status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "DRAFT";
};

export type CrmWarranty = {
  id: string;
  assetId: string;
  kind: WarrantyKind;
  status: WarrantyStatus;
  startDate: string;
  endDate: string;
  coveredComponents: string[];
  notes: string;
};

export type CrmDocument = {
  id: string;
  customerId: string;
  siteId: string | null;
  assetId: string | null;
  category: DocumentCategory;
  title: string;
  fileName: string;
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  storageRef: string;
};

export type CrmAuditEntry = {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  previousValue: string;
  newValue: string;
  actor: string;
  occurredAt: string;
};

export type CustomerDashboardMetrics = {
  totalSites: number;
  totalPrinters: number;
  fleetHealthPct: number | null;
  openWorkOrders: number;
  upcomingPMs: number;
  overduePMs: number;
  monthlyCopyVolume: number;
  serviceCallsThisMonth: number;
  contractStatus: string;
  warrantyExpiring: number;
  recentActivity: Array<{ label: string; at: string }>;
};

export type SiteDashboardMetrics = {
  printerCount: number;
  fleetHealthPct: number | null;
  openWorkOrders: number;
  scheduledVisits: number;
  upcomingPMs: number;
  recentRepairs: number;
  partsConsumed: number;
  monthlyVolume: number;
  technicianAssigned: string;
};

export type AssetDashboardMetrics = {
  status: AssetStatus;
  currentCopyCount: number | null;
  pmStatus: string;
  cleaningStatus: string;
  jointUnitStatus: string;
  dtfStatus: string;
  warrantyStatus: WarrantyStatus;
};

export type CrmReportType =
  | "FLEET_HEALTH"
  | "CUSTOMER_INVENTORY"
  | "WARRANTY_EXPIRATION"
  | "CONTRACT_EXPIRATION"
  | "ASSET_AGE"
  | "PM_COMPLIANCE"
  | "SERVICE_HISTORY"
  | "PRINTER_UTILIZATION";

export type CrmSearchHit = {
  kind: "CUSTOMER" | "SITE" | "ASSET" | "CONTACT" | "CONTRACT";
  id: string;
  label: string;
  subtitle: string;
  href: string;
};
