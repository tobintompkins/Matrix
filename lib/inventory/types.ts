export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

export type InventoryLocationType = "truck" | "warehouse";

export type CompatibleModel =
  | "GD9630"
  | "GL9730"
  | "Valezus"
  | "T2200"
  | "T2100";

export type InventoryLocation = {
  id: string;
  type: InventoryLocationType;
  name: string;
  code: string;
  technician?: string;
};

export type InventoryItem = {
  id: string;
  partNumber: string;
  description: string;
  quantityOnHand: number;
  minimumQuantity: number;
  locationId: string;
  locationType: InventoryLocationType;
  locationLabel: string;
  compatibleModels: CompatibleModel[];
  lastUpdated: string;
  stockStatus: StockStatus;
};

export type InventoryTransferStatus = "draft" | "submitted" | "completed";

export type InventoryTransfer = {
  id: string;
  itemId: string;
  partNumber: string;
  description: string;
  quantity: number;
  fromLocationId: string;
  fromLocationType: InventoryLocationType;
  toLocationId: string;
  toLocationType: InventoryLocationType;
  status: InventoryTransferStatus;
  createdAt: string;
  notes?: string;
};

export type EmergencyStockRequest = {
  id: string;
  itemId: string;
  partNumber: string;
  description: string;
  quantityNeeded: number;
  locationId: string;
  locationType: InventoryLocationType;
  compatibleModels: CompatibleModel[];
  reason: string;
  status: "draft" | "flagged";
  createdAt: string;
};

export type PartsOrderDraftLine = {
  id: string;
  itemId: string;
  partNumber: string;
  description: string;
  quantity: number;
  compatibleModels: CompatibleModel[];
  sourceLocationType: InventoryLocationType;
  reason: "low-stock" | "out-of-stock" | "manual" | "emergency";
  /** Optional service-call linkage (Patch 32) */
  serviceCallId?: string;
  workOrderNumber?: string;
  machineId?: string;
  assetTag?: string;
  printerModel?: string;
  emergencyFlag?: boolean;
  orderReason?: string;
};

/** Future integration placeholders — do not wire yet. */
export type InventoryIntegrationPlaceholders = {
  barcodeQrScanLookup: "pending";
  realWarehouseDatabase: "pending";
  realTruckInventoryDatabase: "pending";
  partsOrderSystem: "pending";
  technicianAssignment: "pending";
  inventoryHistoryLog: "pending";
};
