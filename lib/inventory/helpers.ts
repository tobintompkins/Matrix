import type {
  InventoryItem,
  InventoryLocation,
  InventoryTransfer,
  PartsOrderDraftLine,
  StockStatus,
} from "./types";

/** Auto-detect stock status from quantity rules. */
export function deriveStockStatus(
  quantityOnHand: number,
  minimumQuantity: number,
): StockStatus {
  if (quantityOnHand <= 0) return "Out of Stock";
  if (quantityOnHand <= minimumQuantity) return "Low Stock";
  return "In Stock";
}

export function withDerivedStatus(
  item: Omit<InventoryItem, "stockStatus"> & { stockStatus?: StockStatus },
): InventoryItem {
  return {
    ...item,
    stockStatus: deriveStockStatus(item.quantityOnHand, item.minimumQuantity),
  };
}

export function isLowOrOutOfStock(item: InventoryItem): boolean {
  return (
    item.stockStatus === "Low Stock" || item.stockStatus === "Out of Stock"
  );
}

export function createDraftTransfer(input: {
  item: InventoryItem;
  quantity: number;
  toLocation: InventoryLocation;
  notes?: string;
}): InventoryTransfer {
  const { item, quantity, toLocation, notes } = input;
  const now = new Date().toISOString().slice(0, 10);

  return {
    id: `xfer-draft-${item.id}-${Date.now()}`,
    itemId: item.id,
    partNumber: item.partNumber,
    description: item.description,
    quantity: Math.max(1, quantity),
    fromLocationId: item.locationId,
    fromLocationType: item.locationType,
    toLocationId: toLocation.id,
    toLocationType: toLocation.type,
    status: "draft",
    createdAt: now,
    notes,
  };
}

export function createPartsOrderDraftLine(
  item: InventoryItem,
  quantity?: number,
  reason: PartsOrderDraftLine["reason"] = "manual",
): PartsOrderDraftLine {
  const suggested =
    quantity ??
    Math.max(item.minimumQuantity - item.quantityOnHand, 1);

  return {
    id: `pod-${item.id}-${Date.now()}`,
    itemId: item.id,
    partNumber: item.partNumber,
    description: item.description,
    quantity: suggested,
    compatibleModels: item.compatibleModels,
    sourceLocationType: item.locationType,
    reason:
      reason === "manual" && isLowOrOutOfStock(item)
        ? item.stockStatus === "Out of Stock"
          ? "out-of-stock"
          : "low-stock"
        : reason,
  };
}

/** Build a parts-order draft line linked to a service call (local/mock). */
export function createServiceCallPartsOrderDraftLine(input: {
  item: InventoryItem;
  quantity: number;
  serviceCallId: string;
  workOrderNumber: string;
  machineId: string;
  assetTag: string;
  printerModel: string;
  emergency?: boolean;
  orderReason?: string;
}): PartsOrderDraftLine {
  const line = createPartsOrderDraftLine(
    input.item,
    input.quantity,
    input.emergency ? "emergency" : "manual",
  );
  return {
    ...line,
    serviceCallId: input.serviceCallId,
    workOrderNumber: input.workOrderNumber,
    machineId: input.machineId,
    assetTag: input.assetTag,
    printerModel: input.printerModel,
    emergencyFlag: Boolean(input.emergency),
    orderReason:
      input.orderReason ??
      `Service call ${input.workOrderNumber} parts requirement`,
  };
}

export const INVENTORY_INTEGRATION_PLACEHOLDERS = {
  barcodeQrScanLookup: "pending" as const,
  realWarehouseDatabase: "pending" as const,
  realTruckInventoryDatabase: "pending" as const,
  partsOrderSystem: "pending" as const,
  technicianAssignment: "pending" as const,
  inventoryHistoryLog: "pending" as const,
};
