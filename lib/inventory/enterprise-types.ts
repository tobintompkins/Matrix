/**
 * Enterprise Parts & Inventory (Patch 38).
 * Extends the Patch inventory foundation — does not replace existing types.
 */

export type PartCatalogStatus = "ACTIVE" | "INACTIVE";

export type EnterpriseLocationType =
  | "MAIN_WAREHOUSE"
  | "REGIONAL_WAREHOUSE"
  | "TECHNICIAN_VEHICLE"
  | "CUSTOMER_SITE"
  | "TEMPORARY_JOB_SITE"
  | "CONSIGNMENT"
  | "RETURNED_PARTS";

export type InventoryTxnType =
  | "RECEIVE"
  | "CONSUME"
  | "TRANSFER"
  | "RETURN"
  | "ADJUSTMENT"
  | "CYCLE_COUNT"
  | "SCRAP"
  | "WARRANTY_RETURN"
  | "CUSTOMER_RETURN";

export type ReservationPurpose =
  | "SCHEDULED_PM"
  | "WORK_ORDER"
  | "EMERGENCY_CALL"
  | "INSTALLATION";

export type PurchaseRequestStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ORDERED"
  | "RECEIVED"
  | "CANCELLED";

export type PartCatalogItem = {
  id: string;
  partNumber: string;
  manufacturerPartNumber: string;
  description: string;
  category: string;
  subcategory: string;
  printerModels: string[];
  assembly: string;
  diagramCalloutNumber: string;
  unitOfMeasure: string;
  preferredVendorId: string | null;
  alternateVendorIds: string[];
  cost: number;
  listPrice: number;
  weight: number | null;
  dimensions: string;
  leadTimeDays: number;
  warranty: string;
  photoUrl: string | null;
  technicalDocuments: string[];
  safetyNotes: string;
  status: PartCatalogStatus;
  barcode: string;
  qrCode: string;
  createdAt: string;
  updatedAt: string;
};

export type EnterpriseInventoryLocation = {
  id: string;
  type: EnterpriseLocationType;
  name: string;
  code: string;
  technician?: string;
  customerName?: string;
  region?: string;
  active: boolean;
};

export type StockBalance = {
  id: string;
  partId: string;
  partNumber: string;
  locationId: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityOnOrder: number;
  quantityCommitted: number;
  minimumQuantity: number;
  maximumQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastCountDate: string | null;
  lastUpdated: string;
};

export type InventoryTransaction = {
  id: string;
  type: InventoryTxnType;
  partId: string;
  partNumber: string;
  quantity: number;
  previousOnHand: number;
  newOnHand: number;
  reason: string;
  user: string;
  occurredAt: string;
  workOrderId: string | null;
  purchaseRequestId: string | null;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
};

export type InventoryReservation = {
  id: string;
  partId: string;
  partNumber: string;
  locationId: string;
  quantity: number;
  purpose: ReservationPurpose;
  relatedRecordId: string;
  relatedRecordType: string;
  reservedBy: string;
  reservedAt: string;
  status: "ACTIVE" | "RELEASED" | "CONSUMED";
};

export type PurchaseRequestLine = {
  id: string;
  partId: string;
  partNumber: string;
  description: string;
  quantity: number;
  unitCost: number;
};

export type PurchaseRequest = {
  id: string;
  requestNumber: string;
  requester: string;
  approver: string;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  vendorId: string | null;
  vendorName: string;
  lines: PurchaseRequestLine[];
  justification: string;
  expectedDelivery: string | null;
  status: PurchaseRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type VendorProfile = {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  supportedPartNumbers: string[];
  leadTimeDays: number;
  shippingMethods: string[];
  preferred: boolean;
  onTimeRate: number;
  qualityScore: number;
  active: boolean;
};

export type GuidedDiagramPartLookup = {
  partNumber: string;
  description: string;
  compatibleModels: string[];
  warehouseQuantity: number;
  truckQuantity: number;
  availableQuantity: number;
  vendorAvailability: string;
  partId: string;
};

export type InventoryDashboardMetrics = {
  totalParts: number;
  inventoryValue: number;
  lowStock: number;
  outOfStock: number;
  backordered: number;
  mostUsed: Array<{ partNumber: string; quantity: number }>;
  fastestMoving: Array<{ partNumber: string; quantity: number }>;
  slowMoving: Array<{ partNumber: string; daysSinceMove: number }>;
  upcomingRequired: Array<{ partNumber: string; reason: string }>;
  inventoryAccuracy: number | null;
};

export type ScanAction =
  | "LOOKUP"
  | "COUNT"
  | "RECEIVE"
  | "ISSUE"
  | "TRANSFER"
  | "RESERVE";

export type ScanRequest = {
  code: string;
  action: ScanAction;
  quantity?: number;
  locationId?: string;
  destinationLocationId?: string;
  workOrderId?: string;
  user: string;
  reason?: string;
};

export type ScanResult = {
  ok: boolean;
  error?: string;
  part?: PartCatalogItem;
  balances?: StockBalance[];
  transaction?: InventoryTransaction;
  message?: string;
};

/** Available = On Hand - Reserved (never negative). */
export function quantityAvailable(balance: StockBalance): number {
  return Math.max(0, balance.quantityOnHand - balance.quantityReserved);
}
