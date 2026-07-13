import {
  ENTERPRISE_CATALOG,
  ENTERPRISE_LOCATIONS,
  ENTERPRISE_PURCHASE_REQUESTS,
  ENTERPRISE_STOCK,
  ENTERPRISE_VENDORS,
} from "./enterprise-seed";
import type {
  EnterpriseInventoryLocation,
  GuidedDiagramPartLookup,
  InventoryReservation,
  InventoryTransaction,
  PartCatalogItem,
  PurchaseRequest,
  PurchaseRequestLine,
  ScanRequest,
  ScanResult,
  StockBalance,
  VendorProfile,
} from "./enterprise-types";
import { quantityAvailable } from "./enterprise-types";
import {
  applyInventoryTransaction,
  createPartCatalogItem,
  createReservation,
  nextPurchaseRequestNumber,
  releaseReservation,
  transitionPurchaseRequest,
} from "./enterprise-operations";
import { buildDashboardMetrics, searchCatalog, truckStockSummary } from "./enterprise-calculations";

const STORAGE_KEY = "matrix.enterprise-inventory.v1";

type Store = {
  catalog: PartCatalogItem[];
  locations: EnterpriseInventoryLocation[];
  balances: StockBalance[];
  transactions: InventoryTransaction[];
  reservations: InventoryReservation[];
  purchaseRequests: PurchaseRequest[];
  vendors: VendorProfile[];
  auditLog: InventoryTransaction[];
};

function seedStore(): Store {
  const seedTxns: InventoryTransaction[] = [
    {
      id: "txn-seed-1",
      type: "CONSUME",
      partId: "part-014-12345",
      partNumber: "014-12345",
      quantity: 2,
      previousOnHand: 5,
      newOnHand: 3,
      reason: "WO-2026-000012 master replace",
      user: "Alex Rivera",
      occurredAt: "2026-07-07T15:30:00.000Z",
      workOrderId: "wo-demo-1",
      purchaseRequestId: null,
      sourceLocationId: "loc-truck-alex",
      destinationLocationId: null,
    },
    {
      id: "txn-seed-2",
      type: "RECEIVE",
      partId: "part-014-67890",
      partNumber: "014-67890",
      quantity: 40,
      previousOnHand: 80,
      newOnHand: 120,
      reason: "PO receive",
      user: "Warehouse",
      occurredAt: "2026-07-06T11:00:00.000Z",
      workOrderId: null,
      purchaseRequestId: null,
      sourceLocationId: null,
      destinationLocationId: "loc-main",
    },
    {
      id: "txn-seed-3",
      type: "TRANSFER",
      partId: "part-014-55110",
      partNumber: "014-55110",
      quantity: 1,
      previousOnHand: 16,
      newOnHand: 15,
      reason: "Restock truck",
      user: "Warehouse",
      occurredAt: "2026-07-08T09:00:00.000Z",
      workOrderId: null,
      purchaseRequestId: null,
      sourceLocationId: "loc-main",
      destinationLocationId: "loc-truck-alex",
    },
  ];

  return {
    catalog: structuredClone(ENTERPRISE_CATALOG),
    locations: structuredClone(ENTERPRISE_LOCATIONS),
    balances: structuredClone(ENTERPRISE_STOCK),
    transactions: seedTxns,
    reservations: [
      {
        id: "rsv-seed-1",
        partId: "part-014-12345",
        partNumber: "014-12345",
        locationId: "loc-main",
        quantity: 4,
        purpose: "SCHEDULED_PM",
        relatedRecordId: "pm-sched-1",
        relatedRecordType: "PM",
        reservedBy: "Jordan Lee",
        reservedAt: "2026-07-08T08:00:00.000Z",
        status: "ACTIVE",
      },
      {
        id: "rsv-seed-2",
        partId: "part-s-8224",
        partNumber: "S-8224",
        locationId: "loc-main",
        quantity: 1,
        purpose: "WORK_ORDER",
        relatedRecordId: "wo-demo-2",
        relatedRecordType: "WORK_ORDER",
        reservedBy: "Alex Rivera",
        reservedAt: "2026-07-09T10:00:00.000Z",
        status: "ACTIVE",
      },
    ],
    purchaseRequests: structuredClone(ENTERPRISE_PURCHASE_REQUESTS),
    vendors: structuredClone(ENTERPRISE_VENDORS),
    auditLog: seedTxns,
  };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function readStore(): Store {
  if (!canUseStorage()) return seedStore();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedStore();
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as Store;
  } catch {
    return seedStore();
  }
}

function writeStore(store: Store): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function appendAudit(store: Store, txn: InventoryTransaction): Store {
  return {
    ...store,
    transactions: [txn, ...store.transactions],
    auditLog: [txn, ...store.auditLog],
  };
}

export function listCatalog(query?: string, page?: number, pageSize?: number) {
  const store = readStore();
  return searchCatalog(store.catalog, query ?? "", { page, pageSize, activeOnly: false });
}

export function getCatalogPart(partId: string): PartCatalogItem | null {
  return readStore().catalog.find((p) => p.id === partId) ?? null;
}

export function findPartByNumber(partNumber: string): PartCatalogItem | null {
  const q = partNumber.trim().toLowerCase();
  return (
    readStore().catalog.find(
      (p) =>
        p.partNumber.toLowerCase() === q ||
        p.barcode.toLowerCase() === q ||
        p.qrCode.toLowerCase() === q,
    ) ?? null
  );
}

export function createCatalogPart(
  input: Omit<PartCatalogItem, "id" | "createdAt" | "updatedAt">,
): { ok: boolean; error?: string; part?: PartCatalogItem } {
  const store = readStore();
  const result = createPartCatalogItem(input, store.catalog);
  if (!result.ok || !result.part) return result;
  writeStore({ ...store, catalog: [result.part, ...store.catalog] });
  return result;
}

export function listLocations(): EnterpriseInventoryLocation[] {
  return readStore().locations.filter((l) => l.active);
}

export function listBalances(locationId?: string): StockBalance[] {
  const store = readStore();
  return locationId
    ? store.balances.filter((b) => b.locationId === locationId)
    : store.balances;
}

export function listTransactions(limit = 100): InventoryTransaction[] {
  return readStore().transactions.slice(0, limit);
}

export function listAuditLog(limit = 200): InventoryTransaction[] {
  return readStore().auditLog.slice(0, limit);
}

export function listReservations(status?: "ACTIVE" | "RELEASED" | "CONSUMED") {
  const all = readStore().reservations;
  return status ? all.filter((r) => r.status === status) : all;
}

export function listPurchaseRequests(): PurchaseRequest[] {
  return readStore().purchaseRequests;
}

export function listVendors(): VendorProfile[] {
  return readStore().vendors;
}

export function getDashboardMetrics() {
  const store = readStore();
  return buildDashboardMetrics({
    catalog: store.catalog,
    balances: store.balances,
    transactions: store.transactions,
    upcomingRequired: [
      { partNumber: "S-8224", reason: "Install — Metro Print Co" },
      { partNumber: "014-55110", reason: "PM due — SF9450 fleet" },
    ],
    cycleCountVariancePct: 2.4,
  });
}

export function getTruckStock(technicianLocationId: string) {
  const store = readStore();
  return truckStockSummary(store.balances, technicianLocationId, store.transactions);
}

export function postTransaction(input: {
  type: Parameters<typeof applyInventoryTransaction>[1]["type"];
  partId: string;
  quantity: number;
  reason: string;
  user: string;
  workOrderId?: string | null;
  purchaseRequestId?: string | null;
  sourceLocationId?: string | null;
  destinationLocationId?: string | null;
  setOnHandTo?: number;
}): { ok: boolean; error?: string; transaction?: InventoryTransaction } {
  const store = readStore();
  const part = store.catalog.find((p) => p.id === input.partId);
  if (!part) return { ok: false, error: "Part not found." };
  const result = applyInventoryTransaction(store.balances, {
    ...input,
    part,
  });
  if (!result.ok || !result.transaction) return { ok: false, error: result.error };
  writeStore(appendAudit({ ...store, balances: result.balances }, result.transaction));
  return { ok: true, transaction: result.transaction };
}

export function reservePart(input: {
  partId: string;
  locationId: string;
  quantity: number;
  purpose: InventoryReservation["purpose"];
  relatedRecordId: string;
  relatedRecordType: string;
  reservedBy: string;
}) {
  const store = readStore();
  const part = store.catalog.find((p) => p.id === input.partId);
  if (!part) return { ok: false as const, error: "Part not found." };
  const result = createReservation(store.balances, store.reservations, {
    ...input,
    part,
  });
  if (!result.ok) return { ok: false as const, error: result.error };
  writeStore({
    ...store,
    balances: result.balances,
    reservations: result.reservations,
  });
  return { ok: true as const, reservation: result.reservation };
}

export function releasePartReservation(reservationId: string) {
  const store = readStore();
  const result = releaseReservation(store.balances, store.reservations, reservationId);
  if (!result.ok) return result;
  writeStore({
    ...store,
    balances: result.balances,
    reservations: result.reservations,
  });
  return result;
}

export function createPurchaseRequest(input: {
  requester: string;
  priority: PurchaseRequest["priority"];
  vendorId: string | null;
  lines: Omit<PurchaseRequestLine, "id">[];
  justification: string;
  expectedDelivery?: string | null;
}): { ok: boolean; error?: string; request?: PurchaseRequest } {
  if (!input.lines.length) return { ok: false, error: "At least one line is required." };
  const store = readStore();
  const vendor = input.vendorId
    ? store.vendors.find((v) => v.id === input.vendorId)
    : null;
  const ts = new Date().toISOString();
  const request: PurchaseRequest = {
    id: `pr-${Date.now().toString(36)}`,
    requestNumber: nextPurchaseRequestNumber(store.purchaseRequests),
    requester: input.requester,
    approver: "",
    priority: input.priority,
    vendorId: input.vendorId,
    vendorName: vendor?.name ?? "",
    lines: input.lines.map((l, i) => ({ ...l, id: `prl-${Date.now()}-${i}` })),
    justification: input.justification,
    expectedDelivery: input.expectedDelivery ?? null,
    status: "DRAFT",
    createdAt: ts,
    updatedAt: ts,
  };
  writeStore({
    ...store,
    purchaseRequests: [request, ...store.purchaseRequests],
  });
  return { ok: true, request };
}

export function updatePurchaseRequestStatus(
  requestId: string,
  status: PurchaseRequest["status"],
  approver?: string,
) {
  const store = readStore();
  const current = store.purchaseRequests.find((r) => r.id === requestId);
  if (!current) return { ok: false as const, error: "Request not found." };
  const result = transitionPurchaseRequest(current, status, approver);
  if (!result.ok) return { ok: false as const, error: result.error };
  writeStore({
    ...store,
    purchaseRequests: store.purchaseRequests.map((r) =>
      r.id === requestId ? result.request : r,
    ),
  });
  return { ok: true as const, request: result.request };
}

/**
 * Mobile-ready scan API surface. Call from future native scanner clients.
 */
export function processScan(request: ScanRequest): ScanResult {
  const store = readStore();
  const part =
    store.catalog.find(
      (p) =>
        p.barcode === request.code ||
        p.qrCode === request.code ||
        p.partNumber.toLowerCase() === request.code.toLowerCase(),
    ) ?? null;

  if (!part) {
    return { ok: false, error: "Part not found for scanned code." };
  }

  const balances = store.balances.filter((b) => b.partId === part.id);

  if (request.action === "LOOKUP") {
    return { ok: true, part, balances, message: "Part found." };
  }

  const qty = request.quantity ?? 1;
  const locationId = request.locationId;

  if (request.action === "COUNT") {
    if (!locationId) return { ok: false, error: "locationId required for count.", part };
    const result = applyInventoryTransaction(store.balances, {
      type: "CYCLE_COUNT",
      part,
      quantity: qty,
      setOnHandTo: qty,
      reason: request.reason ?? "Scan cycle count",
      user: request.user,
      sourceLocationId: locationId,
    });
    if (!result.ok || !result.transaction) return { ok: false, error: result.error, part };
    writeStore(appendAudit({ ...store, balances: result.balances }, result.transaction));
    return {
      ok: true,
      part,
      balances: result.balances.filter((b) => b.partId === part.id),
      transaction: result.transaction,
      message: "Cycle count recorded.",
    };
  }

  if (request.action === "RECEIVE") {
    if (!locationId) return { ok: false, error: "locationId required.", part };
    const result = applyInventoryTransaction(store.balances, {
      type: "RECEIVE",
      part,
      quantity: qty,
      reason: request.reason ?? "Scan receive",
      user: request.user,
      destinationLocationId: locationId,
    });
    if (!result.ok || !result.transaction) return { ok: false, error: result.error, part };
    writeStore(appendAudit({ ...store, balances: result.balances }, result.transaction));
    return { ok: true, part, transaction: result.transaction, message: "Received." };
  }

  if (request.action === "ISSUE") {
    if (!locationId) return { ok: false, error: "locationId required.", part };
    const result = applyInventoryTransaction(store.balances, {
      type: "CONSUME",
      part,
      quantity: qty,
      reason: request.reason ?? "Scan issue",
      user: request.user,
      workOrderId: request.workOrderId,
      sourceLocationId: locationId,
    });
    if (!result.ok || !result.transaction) return { ok: false, error: result.error, part };
    writeStore(appendAudit({ ...store, balances: result.balances }, result.transaction));
    return { ok: true, part, transaction: result.transaction, message: "Issued." };
  }

  if (request.action === "TRANSFER") {
    if (!locationId || !request.destinationLocationId) {
      return { ok: false, error: "source and destination required.", part };
    }
    const result = applyInventoryTransaction(store.balances, {
      type: "TRANSFER",
      part,
      quantity: qty,
      reason: request.reason ?? "Scan transfer",
      user: request.user,
      sourceLocationId: locationId,
      destinationLocationId: request.destinationLocationId,
    });
    if (!result.ok || !result.transaction) return { ok: false, error: result.error, part };
    writeStore(appendAudit({ ...store, balances: result.balances }, result.transaction));
    return { ok: true, part, transaction: result.transaction, message: "Transferred." };
  }

  if (request.action === "RESERVE") {
    if (!locationId) return { ok: false, error: "locationId required.", part };
    const result = createReservation(store.balances, store.reservations, {
      part,
      locationId,
      quantity: qty,
      purpose: "WORK_ORDER",
      relatedRecordId: request.workOrderId ?? "scan-reserve",
      relatedRecordType: "WORK_ORDER",
      reservedBy: request.user,
    });
    if (!result.ok) return { ok: false, error: result.error, part };
    writeStore({
      ...store,
      balances: result.balances,
      reservations: result.reservations,
    });
    return {
      ok: true,
      part,
      balances: result.balances.filter((b) => b.partId === part.id),
      message: "Reserved.",
    };
  }

  return { ok: false, error: "Unknown scan action.", part };
}

export function lookupGuidedDiagramPart(input: {
  printerModel: string;
  assembly: string;
  calloutNumber: string;
  partNumber?: string;
  truckLocationId?: string;
}): GuidedDiagramPartLookup | null {
  const store = readStore();
  const part =
    (input.partNumber
      ? store.catalog.find(
          (p) =>
            p.status === "ACTIVE" &&
            p.partNumber.toLowerCase() === input.partNumber!.toLowerCase(),
        )
      : undefined) ??
    store.catalog.find(
      (p) =>
        p.status === "ACTIVE" &&
        p.diagramCalloutNumber === input.calloutNumber &&
        p.assembly.toLowerCase() === input.assembly.toLowerCase() &&
        p.printerModels.some(
          (m) => m.toLowerCase() === input.printerModel.toLowerCase(),
        ),
    );
  if (!part) return null;

  const warehouseIds = new Set(
    store.locations
      .filter((l) => l.type === "MAIN_WAREHOUSE" || l.type === "REGIONAL_WAREHOUSE")
      .map((l) => l.id),
  );
  const balances = store.balances.filter((b) => b.partId === part.id);
  const warehouseQuantity = balances
    .filter((b) => warehouseIds.has(b.locationId))
    .reduce((s, b) => s + quantityAvailable(b), 0);
  const truckQuantity = input.truckLocationId
    ? balances
        .filter((b) => b.locationId === input.truckLocationId)
        .reduce((s, b) => s + quantityAvailable(b), 0)
    : balances
        .filter((b) =>
          store.locations.some(
            (l) => l.id === b.locationId && l.type === "TECHNICIAN_VEHICLE",
          ),
        )
        .reduce((s, b) => s + quantityAvailable(b), 0);

  const vendor = store.vendors.find((v) => v.id === part.preferredVendorId);
  return {
    partId: part.id,
    partNumber: part.partNumber,
    description: part.description,
    compatibleModels: part.printerModels,
    warehouseQuantity,
    truckQuantity,
    availableQuantity: warehouseQuantity + truckQuantity,
    vendorAvailability: vendor
      ? `${vendor.name} · ${vendor.leadTimeDays}d lead`
      : "No preferred vendor",
  };
}

export function resetEnterpriseInventoryForTests(): void {
  if (canUseStorage()) sessionStorage.removeItem(STORAGE_KEY);
}

export type InventoryReportType =
  | "VALUATION"
  | "USAGE_HISTORY"
  | "TECHNICIAN_STOCK"
  | "CUSTOMER_INVENTORY"
  | "LOW_STOCK"
  | "CYCLE_COUNTS"
  | "TRANSACTIONS"
  | "PURCHASE_REQUESTS"
  | "VENDOR_PERFORMANCE";

export function generateInventoryReport(type: InventoryReportType): {
  title: string;
  rows: Array<Record<string, string | number>>;
} {
  const store = readStore();
  switch (type) {
    case "VALUATION": {
      const cost = new Map(store.catalog.map((p) => [p.id, p.cost]));
      return {
        title: "Inventory Valuation",
        rows: store.balances.map((b) => ({
          partNumber: b.partNumber,
          locationId: b.locationId,
          onHand: b.quantityOnHand,
          value: Math.round(b.quantityOnHand * (cost.get(b.partId) ?? 0) * 100) / 100,
        })),
      };
    }
    case "USAGE_HISTORY":
      return {
        title: "Usage History",
        rows: store.transactions
          .filter((t) => t.type === "CONSUME")
          .map((t) => ({
            partNumber: t.partNumber,
            quantity: t.quantity,
            user: t.user,
            date: t.occurredAt,
            workOrder: t.workOrderId ?? "",
          })),
      };
    case "TECHNICIAN_STOCK": {
      const trucks = store.locations.filter((l) => l.type === "TECHNICIAN_VEHICLE");
      return {
        title: "Technician Stock",
        rows: store.balances
          .filter((b) => trucks.some((t) => t.id === b.locationId))
          .map((b) => {
            const loc = trucks.find((t) => t.id === b.locationId);
            return {
              technician: loc?.technician ?? "",
              partNumber: b.partNumber,
              onHand: b.quantityOnHand,
              available: quantityAvailable(b),
            };
          }),
      };
    }
    case "CUSTOMER_INVENTORY": {
      const sites = store.locations.filter((l) => l.type === "CUSTOMER_SITE");
      return {
        title: "Customer Inventory",
        rows: store.balances
          .filter((b) => sites.some((s) => s.id === b.locationId))
          .map((b) => {
            const loc = sites.find((s) => s.id === b.locationId);
            return {
              customer: loc?.customerName ?? "",
              partNumber: b.partNumber,
              onHand: b.quantityOnHand,
            };
          }),
      };
    }
    case "LOW_STOCK":
      return {
        title: "Low Stock",
        rows: store.balances
          .filter((b) => quantityAvailable(b) <= b.reorderPoint)
          .map((b) => ({
            partNumber: b.partNumber,
            locationId: b.locationId,
            available: quantityAvailable(b),
            reorderPoint: b.reorderPoint,
          })),
      };
    case "CYCLE_COUNTS":
      return {
        title: "Cycle Counts",
        rows: store.transactions
          .filter((t) => t.type === "CYCLE_COUNT")
          .map((t) => ({
            partNumber: t.partNumber,
            previous: t.previousOnHand,
            counted: t.newOnHand,
            user: t.user,
            date: t.occurredAt,
          })),
      };
    case "TRANSACTIONS":
      return {
        title: "Inventory Transactions",
        rows: store.transactions.map((t) => ({
          type: t.type,
          partNumber: t.partNumber,
          quantity: t.quantity,
          user: t.user,
          date: t.occurredAt,
        })),
      };
    case "PURCHASE_REQUESTS":
      return {
        title: "Purchase Requests",
        rows: store.purchaseRequests.map((r) => ({
          number: r.requestNumber,
          status: r.status,
          requester: r.requester,
          vendor: r.vendorName,
          lines: r.lines.length,
        })),
      };
    case "VENDOR_PERFORMANCE":
      return {
        title: "Vendor Performance",
        rows: store.vendors.map((v) => ({
          name: v.name,
          onTimeRate: Math.round(v.onTimeRate * 100),
          qualityScore: Math.round(v.qualityScore * 100),
          leadTimeDays: v.leadTimeDays,
          preferred: v.preferred ? "Yes" : "No",
        })),
      };
    default:
      return { title: "Report", rows: [] };
  }
}
