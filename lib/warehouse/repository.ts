/**
 * Warehouse repository (Patch 43) — sessionStorage store + enterprise inventory integration.
 */

import {
  listBalances,
  listCatalog,
  listLocations,
  listPurchaseRequests,
  listTransactions,
  listVendors,
  postTransaction,
  updatePurchaseRequestStatus,
  type EnterpriseInventoryLocation,
} from "@/lib/inventory";
import { notifyInventoryEvent } from "@/lib/notifications";
import {
  buildWarehouseStockRows,
  computeWarehouseAnalytics,
  computeWarehouseDashboard,
  exportStockToCsv,
  filterStockByStatus,
  searchWarehouseStock,
} from "./calculations";
import {
  advanceTransferStatus,
  applyCycleCountActuals,
  buildTruckRestockLines,
  createCycleCountSession,
  createReceivingSession,
  createTransferOrder,
  createTruckRestockRequest,
  createWarehouseAudit,
  inferTransferKind,
  nextReceivingStep,
  validateReceivingAdvance,
} from "./operations";
import {
  BIN_LOCATIONS,
  SEED_ALERTS,
  SEED_AUDIT,
  SEED_CYCLE_COUNTS,
  SEED_RECEIVING,
  SEED_TRANSFERS,
  SEED_TRUCK_RESTOCK,
  STOCK_BIN_ASSIGNMENTS,
  WAREHOUSE_EMPLOYEES,
  WAREHOUSE_PROFILES,
} from "./seed";
import type {
  BinLocation,
  BinStockStatus,
  CycleCountSession,
  CycleCountType,
  InventoryAlert,
  InventoryTransferOrder,
  ReceivingSession,
  TransferKind,
  TransferStatus,
  TruckRestockRequest,
  WarehouseAuditEntry,
  WarehouseEmployee,
  WarehouseProfile,
  WarehouseStockRow,
} from "./types";

const STORAGE_KEY = "matrix.warehouse.v1";

type Store = {
  warehouses: WarehouseProfile[];
  bins: BinLocation[];
  binByBalanceId: Record<string, string>;
  transfers: InventoryTransferOrder[];
  receiving: ReceivingSession[];
  cycleCounts: CycleCountSession[];
  truckRestocks: TruckRestockRequest[];
  alerts: InventoryAlert[];
  audit: WarehouseAuditEntry[];
  employees: WarehouseEmployee[];
};

let memoryStore: Store | null = null;

function seedStore(): Store {
  return {
    warehouses: structuredClone(WAREHOUSE_PROFILES),
    bins: structuredClone(BIN_LOCATIONS),
    binByBalanceId: { ...STOCK_BIN_ASSIGNMENTS },
    transfers: structuredClone(SEED_TRANSFERS),
    receiving: structuredClone(SEED_RECEIVING),
    cycleCounts: structuredClone(SEED_CYCLE_COUNTS),
    truckRestocks: structuredClone(SEED_TRUCK_RESTOCK),
    alerts: structuredClone(SEED_ALERTS),
    audit: structuredClone(SEED_AUDIT),
    employees: structuredClone(WAREHOUSE_EMPLOYEES),
  };
}

function readStore(): Store {
  if (typeof window === "undefined") {
    if (!memoryStore) memoryStore = seedStore();
    return memoryStore;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      memoryStore = JSON.parse(raw) as Store;
      return memoryStore;
    }
  } catch {
    // fall through
  }
  memoryStore = seedStore();
  writeStore(memoryStore);
  return memoryStore;
}

function writeStore(store: Store): void {
  memoryStore = store;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota
  }
}

function appendAudit(entry: WarehouseAuditEntry): void {
  const store = readStore();
  store.audit = [entry, ...store.audit].slice(0, 2000);
  writeStore(store);
}

function pushAlert(alert: Omit<InventoryAlert, "id" | "createdAt" | "acknowledgedAt">): void {
  const store = readStore();
  store.alerts = [
    {
      ...alert,
      id: `alert-${Date.now()}`,
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
    },
    ...store.alerts,
  ].slice(0, 500);
  writeStore(store);

  const typeMap: Record<InventoryAlert["type"], import("@/lib/notifications").NotificationType> = {
    CRITICAL_STOCK: "INVENTORY_CRITICAL_STOCK",
    OUT_OF_STOCK: "INVENTORY_OUT_OF_STOCK",
    RECEIVING_COMPLETED: "INVENTORY_RECEIVING_COMPLETED",
    TRANSFER_DELIVERED: "INVENTORY_TRANSFER_DELIVERED",
    TRANSFER_DELAYED: "INVENTORY_TRANSFER_DELAYED",
    CYCLE_COUNT_DUE: "INVENTORY_CYCLE_COUNT_DUE",
    INVENTORY_VARIANCE: "INVENTORY_VARIANCE",
    EXPIRED_CONSUMABLES: "INVENTORY_EXPIRED_CONSUMABLES",
  };
  notifyInventoryEvent({
    type: typeMap[alert.type],
    title: alert.title,
    message: alert.message,
    warehouseId: alert.warehouseId,
    partNumber: alert.partNumber,
    referenceId: alert.referenceId,
    priority: alert.priority,
  });
}

export function resetWarehouseForTests(): void {
  memoryStore = seedStore();
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function listWarehouses(): WarehouseProfile[] {
  return readStore().warehouses.filter((w) => w.status !== "INACTIVE");
}

export function listAllWarehouses(): WarehouseProfile[] {
  return readStore().warehouses;
}

export function getWarehouse(id: string): WarehouseProfile | null {
  return readStore().warehouses.find((w) => w.id === id) ?? null;
}

export function listBins(warehouseId?: string): BinLocation[] {
  const bins = readStore().bins.filter((b) => b.active);
  return warehouseId ? bins.filter((b) => b.warehouseId === warehouseId) : bins;
}

export function getBin(id: string): BinLocation | null {
  return readStore().bins.find((b) => b.id === id) ?? null;
}

export function listWarehouseEmployees(warehouseId: string): WarehouseEmployee[] {
  return readStore().employees.filter((e) => e.warehouseId === warehouseId && e.active);
}

export function listWarehouseStock(options?: {
  warehouseId?: string;
  query?: string;
  status?: BinStockStatus | "ALL";
}): WarehouseStockRow[] {
  const store = readStore();
  let rows = buildWarehouseStockRows({
    warehouses: store.warehouses,
    bins: store.bins,
    binByBalanceId: store.binByBalanceId,
    catalog: listCatalog("", 1, 500).items,
    balances: listBalances(),
    vendors: listVendors(),
    warehouseId: options?.warehouseId,
  });
  if (options?.query) rows = searchWarehouseStock(rows, options.query);
  if (options?.status) rows = filterStockByStatus(rows, options.status);
  return rows;
}

export function getWarehouseDashboard() {
  const store = readStore();
  const rows = listWarehouseStock();
  const truckBalances = listBalances().filter((b) => {
    const loc = listLocations().find((l) => l.id === b.locationId);
    return loc?.type === "TECHNICIAN_VEHICLE";
  });
  return computeWarehouseDashboard({
    rows,
    transfers: store.transfers,
    purchaseRequests: listPurchaseRequests(),
    receiving: store.receiving,
    truckBalances,
  });
}

export function getWarehouseAnalytics() {
  const store = readStore();
  return computeWarehouseAnalytics({
    warehouses: store.warehouses,
    rows: listWarehouseStock(),
    transfers: store.transfers,
    receiving: store.receiving,
    transactions: listTransactions(),
  });
}

export function exportWarehouseStockCsv(warehouseId?: string): string {
  return exportStockToCsv(listWarehouseStock({ warehouseId }));
}

export function listTransfers(status?: TransferStatus | "ALL"): InventoryTransferOrder[] {
  const transfers = readStore().transfers;
  if (!status || status === "ALL") return transfers;
  return transfers.filter((t) => t.status === status);
}

export function getTransfer(id: string): InventoryTransferOrder | null {
  return readStore().transfers.find((t) => t.id === id) ?? null;
}

export function requestTransfer(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  fromLocationId: string;
  toLocationId: string;
  requestedBy: string;
  notes: string;
  lines: Array<{
    partId: string;
    partNumber: string;
    description: string;
    quantity: number;
    binFromId?: string | null;
    binToId?: string | null;
  }>;
  emergency?: boolean;
  kind?: TransferKind;
}): { ok: true; transfer: InventoryTransferOrder } | { ok: false; error: string } {
  if (!input.lines.length) return { ok: false, error: "Add at least one transfer line." };
  if (input.lines.some((l) => l.quantity <= 0)) {
    return { ok: false, error: "Quantities must be positive." };
  }
  const locations = listLocations();
  const fromLoc = locations.find((l) => l.id === input.fromLocationId);
  const toLoc = locations.find((l) => l.id === input.toLocationId);
  if (!fromLoc || !toLoc) return { ok: false, error: "Invalid source or destination location." };

  const store = readStore();
  const kind =
    input.kind ??
    inferTransferKind(fromLoc.type, toLoc.type, input.emergency);
  const transfer = createTransferOrder({
    existing: store.transfers,
    kind,
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    requestedBy: input.requestedBy,
    notes: input.notes,
    lines: input.lines,
    emergency: input.emergency,
  });
  store.transfers = [transfer, ...store.transfers];
  writeStore(store);
  appendAudit(
    createWarehouseAudit({
      technician: input.requestedBy,
      warehouseId: input.fromWarehouseId,
      reason: `Transfer requested ${transfer.transferNumber}`,
      referenceNumber: transfer.transferNumber,
      sourceModule: "warehouse-transfers",
    }),
  );
  return { ok: true, transfer };
}

export function updateTransferStatus(
  transferId: string,
  next: TransferStatus,
  actor: string,
): { ok: true; transfer: InventoryTransferOrder } | { ok: false; error: string } {
  const store = readStore();
  const idx = store.transfers.findIndex((t) => t.id === transferId);
  if (idx < 0) return { ok: false, error: "Transfer not found." };
  const result = advanceTransferStatus(store.transfers[idx], next, actor);
  if (!result.ok) return result;

  const transfer = result.transfer;

  // When received, post TRANSFER transactions into enterprise inventory
  if (next === "Received") {
    for (const line of transfer.lines) {
      const qty = line.quantityReceived || line.quantityRequested;
      const txn = postTransaction({
        type: "TRANSFER",
        partId: line.partId,
        quantity: qty,
        reason: `Transfer ${transfer.transferNumber}`,
        user: actor,
        sourceLocationId: transfer.fromLocationId,
        destinationLocationId: transfer.toLocationId,
      });
      if (!txn.ok || !txn.transaction) {
        return { ok: false, error: txn.error ?? "Transfer inventory update failed." };
      }
      appendAudit(
        createWarehouseAudit({
          technician: actor,
          warehouseId: transfer.toWarehouseId,
          partNumber: line.partNumber,
          quantityBefore: txn.transaction.previousOnHand,
          quantityAfter: txn.transaction.newOnHand,
          reason: `Transfer received ${transfer.transferNumber}`,
          referenceNumber: transfer.transferNumber,
          sourceModule: "warehouse-transfers",
        }),
      );
    }
    pushAlert({
      type: "TRANSFER_DELIVERED",
      title: "Transfer received",
      message: `${transfer.transferNumber} was received into inventory.`,
      warehouseId: transfer.toWarehouseId,
      partNumber: transfer.lines[0]?.partNumber ?? null,
      referenceId: transfer.id,
      priority: "NORMAL",
    });
  }

  store.transfers[idx] = transfer;
  writeStore(store);
  appendAudit(
    createWarehouseAudit({
      technician: actor,
      warehouseId: transfer.fromWarehouseId,
      reason: `Transfer ${transfer.transferNumber} → ${next}`,
      referenceNumber: transfer.transferNumber,
      sourceModule: "warehouse-transfers",
    }),
  );
  return { ok: true, transfer };
}

export function listReceivingSessions(
  status?: ReceivingSession["status"] | "ALL",
): ReceivingSession[] {
  const sessions = readStore().receiving;
  if (!status || status === "ALL") return sessions;
  return sessions.filter((s) => s.status === status);
}

export function getReceivingSession(id: string): ReceivingSession | null {
  return readStore().receiving.find((s) => s.id === id) ?? null;
}

export function startReceiving(input: {
  warehouseId: string;
  purchaseRequestId: string | null;
  purchaseRequestNumber: string;
  receiver: string;
  lines: Array<{
    partId: string;
    partNumber: string;
    description: string;
    expectedQty: number;
  }>;
}): { ok: true; session: ReceivingSession } | { ok: false; error: string } {
  if (!input.lines.length) return { ok: false, error: "No lines to receive." };
  const store = readStore();
  const session = createReceivingSession({
    existing: store.receiving,
    ...input,
  });
  // Move immediately past SELECT_PO when PO already chosen
  session.step = "RECEIVE_SHIPMENT";
  store.receiving = [session, ...store.receiving];
  writeStore(store);
  return { ok: true, session };
}

export function updateReceivingSession(session: ReceivingSession): ReceivingSession {
  const store = readStore();
  const idx = store.receiving.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    store.receiving[idx] = session;
    writeStore(store);
  }
  return session;
}

export function advanceReceiving(
  sessionId: string,
): { ok: true; session: ReceivingSession } | { ok: false; error: string } {
  const store = readStore();
  const idx = store.receiving.findIndex((s) => s.id === sessionId);
  if (idx < 0) return { ok: false, error: "Receiving session not found." };
  const session = store.receiving[idx];
  if (session.status !== "IN_PROGRESS") {
    return { ok: false, error: "Session is not in progress." };
  }
  const valid = validateReceivingAdvance(session);
  if (!valid.ok) return valid;

  if (session.step === "PRINT_LABELS" || session.step === "COMPLETE") {
    // Complete: post RECEIVE transactions
    const warehouse = store.warehouses.find((w) => w.id === session.warehouseId);
    const destLocationId = warehouse?.enterpriseLocationId ?? "loc-main";
    for (const line of session.lines) {
      if (line.receivedQty <= 0) continue;
      const txn = postTransaction({
        type: "RECEIVE",
        partId: line.partId,
        quantity: line.receivedQty,
        reason: `Receiving ${session.sessionNumber}`,
        user: session.receiver,
        destinationLocationId: destLocationId,
        purchaseRequestId: session.purchaseRequestId,
      });
      if (!txn.ok || !txn.transaction) {
        return { ok: false, error: txn.error ?? "Receive inventory update failed." };
      }
      if (line.binLocationId) {
        const bal = listBalances(destLocationId).find((b) => b.partId === line.partId);
        if (bal) store.binByBalanceId[bal.id] = line.binLocationId;
      }
      appendAudit(
        createWarehouseAudit({
          technician: session.receiver,
          warehouseId: session.warehouseId,
          partNumber: line.partNumber,
          quantityBefore: txn.transaction.previousOnHand,
          quantityAfter: txn.transaction.newOnHand,
          reason: `Received via ${session.sessionNumber}`,
          referenceNumber: session.sessionNumber,
          sourceModule: "warehouse-receiving",
        }),
      );
    }
    if (session.purchaseRequestId) {
      updatePurchaseRequestStatus(session.purchaseRequestId, "RECEIVED");
    }
    const completed: ReceivingSession = {
      ...session,
      step: "COMPLETE",
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
    };
    store.receiving[idx] = completed;
    writeStore(store);
    pushAlert({
      type: "RECEIVING_COMPLETED",
      title: "Receiving completed",
      message: `${session.sessionNumber} posted inventory for ${session.purchaseRequestNumber}.`,
      warehouseId: session.warehouseId,
      partNumber: session.lines[0]?.partNumber ?? null,
      referenceId: session.id,
      priority: "NORMAL",
    });
    return { ok: true, session: completed };
  }

  const next = nextReceivingStep(session.step);
  if (!next) return { ok: false, error: "No further receiving steps." };
  const updated = { ...session, step: next };
  store.receiving[idx] = updated;
  writeStore(store);
  return { ok: true, session: updated };
}

export function listCycleCounts(
  status?: CycleCountSession["status"] | "ALL",
): CycleCountSession[] {
  const counts = readStore().cycleCounts;
  if (!status || status === "ALL") return counts;
  return counts.filter((c) => c.status === status);
}

export function getCycleCount(id: string): CycleCountSession | null {
  return readStore().cycleCounts.find((c) => c.id === id) ?? null;
}

export function startCycleCount(input: {
  warehouseId: string;
  type: CycleCountType;
  createdBy: string;
  categoryFilter?: string | null;
  binFilter?: string | null;
}): { ok: true; session: CycleCountSession } | { ok: false; error: string } {
  const store = readStore();
  const rows = listWarehouseStock({ warehouseId: input.warehouseId });
  let filtered = rows;
  if (input.type === "CATEGORY" && input.categoryFilter) {
    filtered = rows.filter((r) => r.category === input.categoryFilter);
  }
  if ((input.type === "BIN" || input.binFilter) && input.binFilter) {
    filtered = rows.filter((r) => r.binLocationId === input.binFilter);
  }
  if (input.type === "RANDOM") {
    filtered = [...rows].sort(() => Math.random() - 0.5).slice(0, 5);
  }
  if (input.type === "ABC") {
    filtered = [...rows]
      .sort((a, b) => b.quantityOnHand * b.unitCost - a.quantityOnHand * a.unitCost)
      .slice(0, 8);
  }
  if (!filtered.length) return { ok: false, error: "No stock lines match this count type." };

  const session = createCycleCountSession({
    existing: store.cycleCounts,
    warehouseId: input.warehouseId,
    type: input.type,
    createdBy: input.createdBy,
    categoryFilter: input.categoryFilter,
    binFilter: input.binFilter,
    lines: filtered.map((r) => ({
      partId: r.partId,
      partNumber: r.partNumber,
      description: r.description,
      binLocationId: r.binLocationId,
      locationCode: r.locationCode,
      expectedQty: r.quantityOnHand,
    })),
  });
  store.cycleCounts = [session, ...store.cycleCounts];
  writeStore(store);
  return { ok: true, session };
}

export function recordCycleCountActuals(
  sessionId: string,
  updates: Array<{ lineId: string; actualQty: number; reason?: string }>,
): { ok: true; session: CycleCountSession } | { ok: false; error: string } {
  const store = readStore();
  const idx = store.cycleCounts.findIndex((c) => c.id === sessionId);
  if (idx < 0) return { ok: false, error: "Cycle count not found." };
  const session = applyCycleCountActuals(store.cycleCounts[idx], updates);
  store.cycleCounts[idx] = session;
  writeStore(store);
  return { ok: true, session };
}

export function completeCycleCount(
  sessionId: string,
  approvedBy: string,
): { ok: true; session: CycleCountSession } | { ok: false; error: string } {
  const store = readStore();
  const idx = store.cycleCounts.findIndex((c) => c.id === sessionId);
  if (idx < 0) return { ok: false, error: "Cycle count not found." };
  const session = store.cycleCounts[idx];
  if (session.lines.some((l) => l.actualQty == null)) {
    return { ok: false, error: "Enter actual quantities for all lines." };
  }
  const warehouse = store.warehouses.find((w) => w.id === session.warehouseId);
  const locationId = warehouse?.enterpriseLocationId ?? "loc-main";

  for (const line of session.lines) {
    if (line.actualQty == null) continue;
    if (line.variance === 0) continue;
    const txn = postTransaction({
      type: "CYCLE_COUNT",
      partId: line.partId,
      quantity: Math.max(1, Math.abs(line.variance ?? 0)),
      setOnHandTo: line.actualQty,
      reason: line.reason || `Cycle count ${session.countNumber}`,
      user: approvedBy,
      sourceLocationId: locationId,
      destinationLocationId: locationId,
    });
    if (!txn.ok || !txn.transaction) {
      return { ok: false, error: txn.error ?? "Cycle count inventory update failed." };
    }
    appendAudit(
      createWarehouseAudit({
        technician: approvedBy,
        warehouseId: session.warehouseId,
        partNumber: line.partNumber,
        quantityBefore: line.expectedQty,
        quantityAfter: line.actualQty,
        reason: `Cycle count variance ${session.countNumber}`,
        referenceNumber: session.countNumber,
        sourceModule: "warehouse-cycle-count",
      }),
    );
    if (Math.abs(line.variance ?? 0) > 0) {
      pushAlert({
        type: "INVENTORY_VARIANCE",
        title: "Inventory variance",
        message: `${line.partNumber} variance ${line.variance} on ${session.countNumber}.`,
        warehouseId: session.warehouseId,
        partNumber: line.partNumber,
        referenceId: session.id,
        priority: Math.abs(line.variance ?? 0) >= 3 ? "HIGH" : "NORMAL",
      });
    }
  }

  const completed: CycleCountSession = {
    ...session,
    status: "COMPLETED",
    approvedBy,
    completedAt: new Date().toISOString(),
  };
  store.cycleCounts[idx] = completed;
  writeStore(store);
  return { ok: true, session: completed };
}

export function getTruckRestockPreview(truckLocationId: string) {
  const loc = listLocations().find((l) => l.id === truckLocationId);
  if (!loc || loc.type !== "TECHNICIAN_VEHICLE") {
    return { ok: false as const, error: "Invalid truck location." };
  }
  const lines = buildTruckRestockLines({
    catalog: listCatalog("", 1, 500).items,
    truckBalances: listBalances(truckLocationId),
  });
  return {
    ok: true as const,
    truck: loc,
    lines,
    missingCritical: lines.filter((l) => l.critical && l.missingQty > 0),
    fastMoving: lines.filter((l) => l.fastMoving),
    emergencyKit: lines.filter((l) => l.emergencyKit),
    consumables: lines.filter((l) => l.consumable),
  };
}

export function generateTruckRestockRequest(input: {
  truckLocationId: string;
  sourceWarehouseId: string;
  createdBy: string;
  notes?: string;
}): { ok: true; request: TruckRestockRequest } | { ok: false; error: string } {
  const preview = getTruckRestockPreview(input.truckLocationId);
  if (!preview.ok) return preview;
  const missing = preview.lines.filter((l) => l.missingQty > 0);
  if (!missing.length) {
    return { ok: false, error: "Truck is already at recommended stock levels." };
  }
  const store = readStore();
  const request = createTruckRestockRequest({
    existing: store.truckRestocks,
    truckLocationId: input.truckLocationId,
    truckName: preview.truck.name,
    technician: preview.truck.technician ?? "Technician",
    sourceWarehouseId: input.sourceWarehouseId,
    createdBy: input.createdBy,
    lines: missing,
    notes: input.notes,
  });
  store.truckRestocks = [request, ...store.truckRestocks];
  writeStore(store);

  // Also create a linked transfer request
  const warehouse = store.warehouses.find((w) => w.id === input.sourceWarehouseId);
  requestTransfer({
    fromWarehouseId: input.sourceWarehouseId,
    toWarehouseId: input.sourceWarehouseId,
    fromLocationId: warehouse?.enterpriseLocationId ?? "loc-main",
    toLocationId: input.truckLocationId,
    requestedBy: input.createdBy,
    notes: `Auto-created from restock ${request.requestNumber}`,
    lines: missing.map((l) => ({
      partId: l.partId,
      partNumber: l.partNumber,
      description: l.description,
      quantity: l.missingQty,
    })),
    kind: "WAREHOUSE_TO_TRUCK",
  });

  appendAudit(
    createWarehouseAudit({
      technician: input.createdBy,
      warehouseId: input.sourceWarehouseId,
      reason: `Truck restock ${request.requestNumber}`,
      referenceNumber: request.requestNumber,
      sourceModule: "warehouse-truck-restock",
    }),
  );

  return { ok: true, request };
}

export function listTruckRestocks(): TruckRestockRequest[] {
  return readStore().truckRestocks;
}

export function listInventoryAlerts(unackedOnly = false): InventoryAlert[] {
  const alerts = readStore().alerts;
  return unackedOnly ? alerts.filter((a) => !a.acknowledgedAt) : alerts;
}

export function acknowledgeAlert(id: string): boolean {
  const store = readStore();
  const alert = store.alerts.find((a) => a.id === id);
  if (!alert) return false;
  alert.acknowledgedAt = new Date().toISOString();
  writeStore(store);
  return true;
}

export function listWarehouseAudit(warehouseId?: string): WarehouseAuditEntry[] {
  const audit = readStore().audit;
  return warehouseId ? audit.filter((a) => a.warehouseId === warehouseId) : audit;
}

export function getWarehouseDetail(warehouseId: string) {
  const warehouse = getWarehouse(warehouseId);
  if (!warehouse) return null;
  const stock = listWarehouseStock({ warehouseId });
  const value = stock.reduce((s, r) => s + r.quantityOnHand * r.unitCost, 0);
  return {
    warehouse,
    stock,
    inventoryValue: Math.round(value * 100) / 100,
    totalParts: new Set(stock.map((s) => s.partId)).size,
    bins: listBins(warehouseId),
    employees: listWarehouseEmployees(warehouseId),
    receiving: listReceivingSessions().filter((r) => r.warehouseId === warehouseId),
    transfers: listTransfers().filter(
      (t) => t.fromWarehouseId === warehouseId || t.toWarehouseId === warehouseId,
    ),
    cycleCounts: listCycleCounts().filter((c) => c.warehouseId === warehouseId),
    activity: listWarehouseAudit(warehouseId).slice(0, 50),
  };
}

export function resolveEnterpriseLocation(
  locationId: string,
): EnterpriseInventoryLocation | null {
  return listLocations().find((l) => l.id === locationId) ?? null;
}
