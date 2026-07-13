import { TRANSFER_STATUS_FLOW } from "./types";
import type {
  BinLocation,
  BinStockStatus,
  InventoryTransferOrder,
  ReceivingSession,
  TransferStatus,
  WarehouseAnalytics,
  WarehouseDashboardMetrics,
  WarehouseProfile,
  WarehouseStockRow,
} from "./types";
import { matchesBinSegment } from "./location";
import type { PartCatalogItem, StockBalance, VendorProfile } from "@/lib/inventory";
import {
  isBackordered,
  isLowStock,
  isOutOfStock,
  quantityAvailable,
  usageByPart,
  type InventoryTransaction,
  type PurchaseRequest,
} from "@/lib/inventory";

export function deriveBinStockStatus(
  balance: StockBalance,
  part: PartCatalogItem | undefined,
): BinStockStatus {
  if (part?.status === "INACTIVE") return "Discontinued";
  if (isBackordered(balance)) return "Back Ordered";
  if (isOutOfStock(balance)) return "Out of Stock";
  const available = quantityAvailable(balance);
  if (available <= Math.max(1, Math.floor(balance.minimumQuantity * 0.5))) {
    return "Critical";
  }
  if (isLowStock(balance) || available <= balance.minimumQuantity) return "Low";
  return "Healthy";
}

export function buildWarehouseStockRows(input: {
  warehouses: WarehouseProfile[];
  bins: BinLocation[];
  binByBalanceId: Record<string, string>;
  catalog: PartCatalogItem[];
  balances: StockBalance[];
  vendors: VendorProfile[];
  warehouseId?: string;
}): WarehouseStockRow[] {
  const { warehouses, bins, binByBalanceId, catalog, balances, vendors, warehouseId } =
    input;
  const warehousesByEnterprise = new Map<string, WarehouseProfile[]>();
  for (const w of warehouses) {
    const list = warehousesByEnterprise.get(w.enterpriseLocationId) ?? [];
    list.push(w);
    warehousesByEnterprise.set(w.enterpriseLocationId, list);
  }
  const binById = new Map(bins.map((b) => [b.id, b]));
  const partById = new Map(catalog.map((p) => [p.id, p]));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  const rows: WarehouseStockRow[] = [];
  for (const bal of balances) {
    const candidates = warehousesByEnterprise.get(bal.locationId) ?? [];
    if (!candidates.length) continue;
    const binId = binByBalanceId[bal.id] ?? null;
    const bin = binId ? binById.get(binId) : undefined;
    const wh =
      (bin ? candidates.find((c) => c.id === bin.warehouseId) : undefined) ??
      (warehouseId
        ? candidates.find((c) => c.id === warehouseId)
        : undefined) ??
      candidates.find((c) => c.code.startsWith("WH") && !c.code.includes("EMG")) ??
      candidates[0];
    if (!wh) continue;
    if (warehouseId && wh.id !== warehouseId) continue;
    const part = partById.get(bal.partId);
    if (!part) continue;
    const vendor = part.preferredVendorId
      ? vendorById.get(part.preferredVendorId)
      : undefined;

    rows.push({
      id: bal.id,
      partId: part.id,
      partNumber: part.partNumber,
      description: part.description,
      manufacturer: part.manufacturerPartNumber.split("-")[0] ?? "RISO",
      category: part.category,
      compatibleModels: part.printerModels,
      warehouseId: wh.id,
      warehouseName: wh.name,
      warehouseCode: wh.code,
      binLocationId: bin?.id ?? null,
      zone: bin?.zone ?? "",
      aisle: bin?.aisle ?? "",
      rack: bin?.rack ?? "",
      shelf: bin?.shelf ?? "",
      bin: bin?.bin ?? "",
      drawer: bin?.drawer ?? "",
      locationCode: bin?.code ?? wh.code,
      quantityOnHand: bal.quantityOnHand,
      quantityReserved: bal.quantityReserved,
      quantityAvailable: quantityAvailable(bal),
      minimumStock: bal.minimumQuantity,
      maximumStock: bal.maximumQuantity,
      unitCost: part.cost,
      status: deriveBinStockStatus(bal, part),
      barcode: part.barcode,
      qrCode: part.qrCode,
      vendorName: vendor?.name ?? "",
      assembly: part.assembly,
      diagramCallout: part.diagramCalloutNumber,
      discontinued: part.status === "INACTIVE",
      backOrdered: isBackordered(bal),
    });
  }
  return rows;
}

export function searchWarehouseStock(
  rows: WarehouseStockRow[],
  query: string,
): WarehouseStockRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    const hay = [
      r.partNumber,
      r.description,
      r.manufacturer,
      r.category,
      r.warehouseName,
      r.warehouseCode,
      r.locationCode,
      r.zone,
      r.aisle,
      r.rack,
      r.shelf,
      r.bin,
      r.drawer,
      r.barcode,
      r.qrCode,
      r.vendorName,
      r.assembly,
      r.diagramCallout,
      ...r.compatibleModels,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q) || matchesBinSegment(r.locationCode, q);
  });
}

export function filterStockByStatus(
  rows: WarehouseStockRow[],
  status: BinStockStatus | "ALL",
): WarehouseStockRow[] {
  if (status === "ALL") return rows;
  return rows.filter((r) => r.status === status);
}

export function computeWarehouseDashboard(input: {
  rows: WarehouseStockRow[];
  transfers: InventoryTransferOrder[];
  purchaseRequests: PurchaseRequest[];
  receiving: ReceivingSession[];
  truckBalances: StockBalance[];
}): WarehouseDashboardMetrics {
  const { rows, transfers, purchaseRequests, receiving, truckBalances } = input;
  const today = new Date().toISOString().slice(0, 10);
  const totalInventoryValue =
    Math.round(rows.reduce((s, r) => s + r.quantityOnHand * r.unitCost, 0) * 100) /
    100;
  const activeParts = new Set(rows.map((r) => r.partId)).size;
  const criticalLowStock = rows.filter(
    (r) => r.status === "Critical" || r.status === "Out of Stock",
  ).length;
  const pendingTransfers = transfers.filter(
    (t) => !["Received", "Cancelled"].includes(t.status),
  ).length;
  const pendingPurchaseOrders = purchaseRequests.filter((p) =>
    ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ORDERED"].includes(p.status),
  ).length;
  const todaysReceipts = receiving.filter(
    (r) =>
      r.status === "COMPLETED" &&
      (r.completedAt?.startsWith(today) || r.startedAt.startsWith(today)),
  ).length;

  const truckCritical = truckBalances.filter(
    (b) => quantityAvailable(b) <= 0 || quantityAvailable(b) <= b.reorderPoint,
  ).length;
  const truckInventoryStatus =
    truckCritical === 0
      ? "Healthy"
      : truckCritical >= 3
        ? "Critical"
        : "Needs Restock";

  const warehouseHealth =
    criticalLowStock === 0
      ? "Healthy"
      : criticalLowStock > 5
        ? "At Risk"
        : "Watch";

  return {
    totalInventoryValue,
    totalActiveParts: activeParts,
    criticalLowStock,
    pendingTransfers,
    pendingPurchaseOrders,
    todaysReceipts,
    truckInventoryStatus,
    warehouseHealth,
    inventoryTurns: 4.2,
    fillRate: 0.94,
    averageDaysOnShelf: 38,
  };
}

export function computeWarehouseAnalytics(input: {
  warehouses: WarehouseProfile[];
  rows: WarehouseStockRow[];
  transfers: InventoryTransferOrder[];
  receiving: ReceivingSession[];
  transactions: InventoryTransaction[];
}): WarehouseAnalytics {
  const { warehouses, rows, transfers, receiving, transactions } = input;
  const inventoryValueByWarehouse = warehouses.map((w) => ({
    warehouseId: w.id,
    name: w.name,
    value:
      Math.round(
        rows
          .filter((r) => r.warehouseId === w.id)
          .reduce((s, r) => s + r.quantityOnHand * r.unitCost, 0) * 100,
      ) / 100,
  }));

  const usage = usageByPart(transactions);
  const fastMovingParts = [...usage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([partNumber, usageCount]) => {
      const row = rows.find((r) => r.partNumber === partNumber);
      return {
        partNumber,
        description: row?.description ?? partNumber,
        usage: usageCount,
      };
    });

  const deadInventory = rows
    .filter((r) => !usage.has(r.partNumber) && r.quantityOnHand > 0)
    .sort((a, b) => b.quantityOnHand * b.unitCost - a.quantityOnHand * a.unitCost)
    .slice(0, 8)
    .map((r) => ({
      partNumber: r.partNumber,
      description: r.description,
      onHand: r.quantityOnHand,
      value: Math.round(r.quantityOnHand * r.unitCost * 100) / 100,
    }));

  const criticalParts = rows
    .filter((r) => r.status === "Critical" || r.status === "Out of Stock")
    .slice(0, 10)
    .map((r) => ({
      partNumber: r.partNumber,
      description: r.description,
      available: r.quantityAvailable,
      warehouse: r.warehouseName,
    }));

  const backOrders = rows.filter((r) => r.backOrdered).length;

  const receivingActivity = groupByDay(
    receiving.map((r) => r.completedAt ?? r.startedAt),
  );
  const transferActivity = groupByDay(transfers.map((t) => t.requestedAt));

  const mostOrderedParts = [...usage.entries()]
    .slice(0, 5)
    .map(([partNumber, count]) => ({ partNumber, count }));

  const mostUsedParts = fastMovingParts.map((p) => ({
    partNumber: p.partNumber,
    usage: p.usage,
  }));

  const mostExpensiveParts = [...rows]
    .sort((a, b) => b.unitCost - a.unitCost)
    .filter(
      (r, i, arr) => arr.findIndex((x) => x.partNumber === r.partNumber) === i,
    )
    .slice(0, 8)
    .map((r) => ({
      partNumber: r.partNumber,
      unitCost: r.unitCost,
      value: Math.round(r.quantityOnHand * r.unitCost * 100) / 100,
    }));

  return {
    inventoryValueByWarehouse,
    fastMovingParts,
    deadInventory,
    criticalParts,
    backOrders,
    receivingActivity,
    transferActivity,
    mostOrderedParts,
    mostUsedParts,
    mostExpensiveParts,
  };
}

function groupByDay(timestamps: string[]): Array<{ date: string; count: number }> {
  const map = new Map<string, number>();
  for (const ts of timestamps) {
    const d = ts.slice(0, 10);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));
}

export function canAdvanceTransfer(
  current: TransferStatus,
  next: TransferStatus,
): boolean {
  return TRANSFER_STATUS_FLOW[current].includes(next);
}

export function exportStockToCsv(rows: WarehouseStockRow[]): string {
  const headers = [
    "Part Number",
    "Description",
    "Manufacturer",
    "Category",
    "Models",
    "Warehouse",
    "Location",
    "On Hand",
    "Reserved",
    "Available",
    "Min",
    "Max",
    "Status",
    "Unit Cost",
  ];
  const lines = rows.map((r) =>
    [
      r.partNumber,
      csvEscape(r.description),
      r.manufacturer,
      r.category,
      r.compatibleModels.join(";"),
      r.warehouseCode,
      r.locationCode,
      r.quantityOnHand,
      r.quantityReserved,
      r.quantityAvailable,
      r.minimumStock,
      r.maximumStock,
      r.status,
      r.unitCost,
    ].join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
