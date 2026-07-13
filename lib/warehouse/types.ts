/**
 * Enterprise Inventory & Warehouse Management (Patch 43).
 * Extends Patch 38 enterprise inventory — does not replace it.
 */

export type WarehouseStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

export type BinStockStatus =
  | "Healthy"
  | "Low"
  | "Critical"
  | "Out of Stock"
  | "Back Ordered"
  | "Discontinued";

export type TransferKind =
  | "WAREHOUSE_TO_WAREHOUSE"
  | "WAREHOUSE_TO_TRUCK"
  | "TRUCK_TO_WAREHOUSE"
  | "TRUCK_TO_TRUCK"
  | "REGIONAL_TO_WAREHOUSE"
  | "EMERGENCY_TO_TECHNICIAN";

export type TransferStatus =
  | "Requested"
  | "Approved"
  | "Picking"
  | "Packed"
  | "In Transit"
  | "Delivered"
  | "Received"
  | "Cancelled";

export type ReceivingStep =
  | "SELECT_PO"
  | "RECEIVE_SHIPMENT"
  | "VERIFY_QUANTITIES"
  | "INSPECT_PARTS"
  | "ASSIGN_LOCATIONS"
  | "PRINT_LABELS"
  | "COMPLETE";

export type ReceivingSessionStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type CycleCountType =
  | "ABC"
  | "RANDOM"
  | "BIN"
  | "CATEGORY"
  | "FULL";

export type CycleCountStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "COMPLETED"
  | "CANCELLED";

export type TruckRestockStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "FULFILLING"
  | "COMPLETED"
  | "CANCELLED";

export type InventoryAlertType =
  | "CRITICAL_STOCK"
  | "OUT_OF_STOCK"
  | "RECEIVING_COMPLETED"
  | "TRANSFER_DELIVERED"
  | "TRANSFER_DELAYED"
  | "CYCLE_COUNT_DUE"
  | "INVENTORY_VARIANCE"
  | "EXPIRED_CONSUMABLES";

/** Hierarchical put-away address within a warehouse. */
export type BinLocation = {
  id: string;
  warehouseId: string;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  drawer: string;
  /** Compact code e.g. WH1-A-03-R2-S4-B17 */
  code: string;
  active: boolean;
};

export type WarehouseProfile = {
  id: string;
  name: string;
  code: string;
  address: string;
  manager: string;
  phone: string;
  email: string;
  receivingDock: string;
  shippingArea: string;
  hours: string;
  status: WarehouseStatus;
  region: string;
  /** Links to enterprise location id (loc-main, etc.) */
  enterpriseLocationId: string;
  activeTechnicianIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type WarehouseStockRow = {
  id: string;
  partId: string;
  partNumber: string;
  description: string;
  manufacturer: string;
  category: string;
  compatibleModels: string[];
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  binLocationId: string | null;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  drawer: string;
  locationCode: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  status: BinStockStatus;
  barcode: string;
  qrCode: string;
  vendorName: string;
  assembly: string;
  diagramCallout: string;
  discontinued: boolean;
  backOrdered: boolean;
};

export type TransferLine = {
  id: string;
  partId: string;
  partNumber: string;
  description: string;
  quantityRequested: number;
  quantityShipped: number;
  quantityReceived: number;
  binFromId: string | null;
  binToId: string | null;
};

export type InventoryTransferOrder = {
  id: string;
  transferNumber: string;
  kind: TransferKind;
  status: TransferStatus;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromLocationId: string;
  toLocationId: string;
  requestedBy: string;
  approvedBy: string | null;
  notes: string;
  lines: TransferLine[];
  requestedAt: string;
  approvedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  receivedAt: string | null;
  cancelledAt: string | null;
  emergency: boolean;
};

export type ReceivingLine = {
  id: string;
  partId: string;
  partNumber: string;
  description: string;
  expectedQty: number;
  receivedQty: number;
  inspectedOk: boolean;
  inspectNotes: string;
  binLocationId: string | null;
  locationCode: string;
};

export type ReceivingSession = {
  id: string;
  sessionNumber: string;
  purchaseRequestId: string | null;
  purchaseRequestNumber: string;
  warehouseId: string;
  step: ReceivingStep;
  status: ReceivingSessionStatus;
  lines: ReceivingLine[];
  receiver: string;
  labelsPrinted: boolean;
  startedAt: string;
  completedAt: string | null;
  notes: string;
};

export type CycleCountLine = {
  id: string;
  partId: string;
  partNumber: string;
  description: string;
  binLocationId: string | null;
  locationCode: string;
  expectedQty: number;
  actualQty: number | null;
  variance: number | null;
  reason: string;
};

export type CycleCountSession = {
  id: string;
  countNumber: string;
  warehouseId: string;
  type: CycleCountType;
  status: CycleCountStatus;
  categoryFilter: string | null;
  binFilter: string | null;
  lines: CycleCountLine[];
  createdBy: string;
  approvedBy: string | null;
  scheduledAt: string;
  completedAt: string | null;
  notes: string;
};

export type TruckRestockLine = {
  id: string;
  partId: string;
  partNumber: string;
  description: string;
  currentQty: number;
  recommendedQty: number;
  missingQty: number;
  critical: boolean;
  fastMoving: boolean;
  emergencyKit: boolean;
  consumable: boolean;
};

export type TruckRestockRequest = {
  id: string;
  requestNumber: string;
  truckLocationId: string;
  truckName: string;
  technician: string;
  sourceWarehouseId: string;
  status: TruckRestockStatus;
  lines: TruckRestockLine[];
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
  notes: string;
};

export type WarehouseAuditEntry = {
  id: string;
  timestamp: string;
  technician: string;
  warehouseId: string | null;
  inventoryItemId: string | null;
  partNumber: string | null;
  quantityBefore: number | null;
  quantityAfter: number | null;
  adjustment: number | null;
  reason: string;
  referenceNumber: string | null;
  sourceModule: string;
  ipAddress: string;
  device: string;
};

export type InventoryAlert = {
  id: string;
  type: InventoryAlertType;
  title: string;
  message: string;
  warehouseId: string | null;
  partNumber: string | null;
  referenceId: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
};

export type WarehouseEmployee = {
  id: string;
  warehouseId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  active: boolean;
};

export type WarehouseDashboardMetrics = {
  totalInventoryValue: number;
  totalActiveParts: number;
  criticalLowStock: number;
  pendingTransfers: number;
  pendingPurchaseOrders: number;
  todaysReceipts: number;
  truckInventoryStatus: "Healthy" | "Needs Restock" | "Critical";
  warehouseHealth: "Healthy" | "Watch" | "At Risk";
  inventoryTurns: number;
  fillRate: number;
  averageDaysOnShelf: number;
};

export type WarehouseAnalytics = {
  inventoryValueByWarehouse: Array<{ warehouseId: string; name: string; value: number }>;
  fastMovingParts: Array<{ partNumber: string; description: string; usage: number }>;
  deadInventory: Array<{ partNumber: string; description: string; onHand: number; value: number }>;
  criticalParts: Array<{ partNumber: string; description: string; available: number; warehouse: string }>;
  backOrders: number;
  receivingActivity: Array<{ date: string; count: number }>;
  transferActivity: Array<{ date: string; count: number }>;
  mostOrderedParts: Array<{ partNumber: string; count: number }>;
  mostUsedParts: Array<{ partNumber: string; usage: number }>;
  mostExpensiveParts: Array<{ partNumber: string; unitCost: number; value: number }>;
};

export const TRANSFER_STATUS_FLOW: Record<TransferStatus, TransferStatus[]> = {
  Requested: ["Approved", "Cancelled"],
  Approved: ["Picking", "Cancelled"],
  Picking: ["Packed", "Cancelled"],
  Packed: ["In Transit", "Cancelled"],
  "In Transit": ["Delivered", "Cancelled"],
  Delivered: ["Received"],
  Received: [],
  Cancelled: [],
};
