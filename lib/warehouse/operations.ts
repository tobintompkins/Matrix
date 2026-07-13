import type {
  CycleCountLine,
  CycleCountSession,
  CycleCountType,
  InventoryTransferOrder,
  ReceivingLine,
  ReceivingSession,
  ReceivingStep,
  TransferKind,
  TransferLine,
  TransferStatus,
  TruckRestockLine,
  TruckRestockRequest,
  WarehouseAuditEntry,
} from "./types";
import { TRANSFER_STATUS_FLOW } from "./types";
import {
  TRUCK_CONSUMABLES,
  TRUCK_CRITICAL_PARTS,
  TRUCK_EMERGENCY_KIT,
  TRUCK_FAST_MOVING,
  TRUCK_RECOMMENDED_STOCK,
} from "./seed";
import type { PartCatalogItem, StockBalance } from "@/lib/inventory";
import { quantityAvailable } from "@/lib/inventory";

export function nextTransferNumber(existing: InventoryTransferOrder[]): string {
  const year = new Date().getFullYear();
  const seq =
    existing
      .map((t) => {
        const m = t.transferNumber.match(/XFR-(\d{4})-(\d+)/);
        return m && Number(m[1]) === year ? Number(m[2]) : 0;
      })
      .reduce((a, b) => Math.max(a, b), 0) + 1;
  return `XFR-${year}-${String(seq).padStart(4, "0")}`;
}

export function nextReceivingNumber(existing: ReceivingSession[]): string {
  const year = new Date().getFullYear();
  const seq =
    existing
      .map((r) => {
        const m = r.sessionNumber.match(/RCV-(\d{4})-(\d+)/);
        return m && Number(m[1]) === year ? Number(m[2]) : 0;
      })
      .reduce((a, b) => Math.max(a, b), 0) + 1;
  return `RCV-${year}-${String(seq).padStart(4, "0")}`;
}

export function nextCycleCountNumber(existing: CycleCountSession[]): string {
  const year = new Date().getFullYear();
  const seq =
    existing
      .map((c) => {
        const m = c.countNumber.match(/CC-(\d{4})-(\d+)/);
        return m && Number(m[1]) === year ? Number(m[2]) : 0;
      })
      .reduce((a, b) => Math.max(a, b), 0) + 1;
  return `CC-${year}-${String(seq).padStart(4, "0")}`;
}

export function nextRestockNumber(existing: TruckRestockRequest[]): string {
  const year = new Date().getFullYear();
  const seq =
    existing
      .map((r) => {
        const m = r.requestNumber.match(/TRS-(\d{4})-(\d+)/);
        return m && Number(m[1]) === year ? Number(m[2]) : 0;
      })
      .reduce((a, b) => Math.max(a, b), 0) + 1;
  return `TRS-${year}-${String(seq).padStart(4, "0")}`;
}

export function inferTransferKind(
  fromType: string,
  toType: string,
  emergency = false,
): TransferKind {
  if (emergency && toType === "TECHNICIAN_VEHICLE") {
    return "EMERGENCY_TO_TECHNICIAN";
  }
  if (fromType === "REGIONAL_WAREHOUSE" && toType.includes("WAREHOUSE")) {
    return "REGIONAL_TO_WAREHOUSE";
  }
  if (fromType.includes("WAREHOUSE") && toType === "TECHNICIAN_VEHICLE") {
    return "WAREHOUSE_TO_TRUCK";
  }
  if (fromType === "TECHNICIAN_VEHICLE" && toType.includes("WAREHOUSE")) {
    return "TRUCK_TO_WAREHOUSE";
  }
  if (fromType === "TECHNICIAN_VEHICLE" && toType === "TECHNICIAN_VEHICLE") {
    return "TRUCK_TO_TRUCK";
  }
  return "WAREHOUSE_TO_WAREHOUSE";
}

export function createTransferOrder(input: {
  existing: InventoryTransferOrder[];
  kind: TransferKind;
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
}): InventoryTransferOrder {
  const now = new Date().toISOString();
  return {
    id: `xfr-${Date.now()}`,
    transferNumber: nextTransferNumber(input.existing),
    kind: input.kind,
    status: "Requested",
    fromWarehouseId: input.fromWarehouseId,
    toWarehouseId: input.toWarehouseId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    requestedBy: input.requestedBy,
    approvedBy: null,
    notes: input.notes,
    lines: input.lines.map(
      (l, i): TransferLine => ({
        id: `xfrl-${Date.now()}-${i}`,
        partId: l.partId,
        partNumber: l.partNumber,
        description: l.description,
        quantityRequested: l.quantity,
        quantityShipped: 0,
        quantityReceived: 0,
        binFromId: l.binFromId ?? null,
        binToId: l.binToId ?? null,
      }),
    ),
    requestedAt: now,
    approvedAt: null,
    shippedAt: null,
    deliveredAt: null,
    receivedAt: null,
    cancelledAt: null,
    emergency: input.emergency ?? false,
  };
}

export function advanceTransferStatus(
  transfer: InventoryTransferOrder,
  next: TransferStatus,
  actor: string,
): { ok: true; transfer: InventoryTransferOrder } | { ok: false; error: string } {
  if (!TRANSFER_STATUS_FLOW[transfer.status].includes(next)) {
    return {
      ok: false,
      error: `Cannot move transfer from ${transfer.status} to ${next}`,
    };
  }
  const now = new Date().toISOString();
  const updated: InventoryTransferOrder = { ...transfer, status: next };
  if (next === "Approved") {
    updated.approvedBy = actor;
    updated.approvedAt = now;
  }
  if (next === "In Transit") {
    updated.shippedAt = now;
    updated.lines = updated.lines.map((l) => ({
      ...l,
      quantityShipped: l.quantityRequested,
    }));
  }
  if (next === "Delivered") updated.deliveredAt = now;
  if (next === "Received") {
    updated.receivedAt = now;
    updated.lines = updated.lines.map((l) => ({
      ...l,
      quantityReceived: l.quantityShipped || l.quantityRequested,
    }));
  }
  if (next === "Cancelled") updated.cancelledAt = now;
  return { ok: true, transfer: updated };
}

const RECEIVING_STEPS: ReceivingStep[] = [
  "SELECT_PO",
  "RECEIVE_SHIPMENT",
  "VERIFY_QUANTITIES",
  "INSPECT_PARTS",
  "ASSIGN_LOCATIONS",
  "PRINT_LABELS",
  "COMPLETE",
];

export function nextReceivingStep(step: ReceivingStep): ReceivingStep | null {
  const i = RECEIVING_STEPS.indexOf(step);
  if (i < 0 || i >= RECEIVING_STEPS.length - 1) return null;
  return RECEIVING_STEPS[i + 1];
}

export function createReceivingSession(input: {
  existing: ReceivingSession[];
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
}): ReceivingSession {
  return {
    id: `rcv-${Date.now()}`,
    sessionNumber: nextReceivingNumber(input.existing),
    purchaseRequestId: input.purchaseRequestId,
    purchaseRequestNumber: input.purchaseRequestNumber,
    warehouseId: input.warehouseId,
    step: "SELECT_PO",
    status: "IN_PROGRESS",
    lines: input.lines.map(
      (l, i): ReceivingLine => ({
        id: `rcvl-${Date.now()}-${i}`,
        partId: l.partId,
        partNumber: l.partNumber,
        description: l.description,
        expectedQty: l.expectedQty,
        receivedQty: 0,
        inspectedOk: false,
        inspectNotes: "",
        binLocationId: null,
        locationCode: "",
      }),
    ),
    receiver: input.receiver,
    labelsPrinted: false,
    startedAt: new Date().toISOString(),
    completedAt: null,
    notes: "",
  };
}

export function validateReceivingAdvance(
  session: ReceivingSession,
): { ok: true } | { ok: false; error: string } {
  switch (session.step) {
    case "SELECT_PO":
      if (!session.purchaseRequestNumber) {
        return { ok: false, error: "Select a purchase order first." };
      }
      return { ok: true };
    case "RECEIVE_SHIPMENT":
      return { ok: true };
    case "VERIFY_QUANTITIES":
      if (session.lines.some((l) => l.receivedQty < 0)) {
        return { ok: false, error: "Received quantities cannot be negative." };
      }
      if (session.lines.every((l) => l.receivedQty === 0)) {
        return { ok: false, error: "Enter at least one received quantity." };
      }
      return { ok: true };
    case "INSPECT_PARTS":
      if (session.lines.some((l) => l.receivedQty > 0 && !l.inspectedOk)) {
        return { ok: false, error: "Inspect and approve all received lines." };
      }
      return { ok: true };
    case "ASSIGN_LOCATIONS":
      if (
        session.lines.some(
          (l) => l.receivedQty > 0 && (!l.binLocationId || !l.locationCode),
        )
      ) {
        return { ok: false, error: "Assign warehouse locations to all received parts." };
      }
      return { ok: true };
    case "PRINT_LABELS":
      if (!session.labelsPrinted) {
        return { ok: false, error: "Print labels before completing receiving." };
      }
      return { ok: true };
    case "COMPLETE":
      return { ok: true };
    default:
      return { ok: false, error: "Unknown receiving step." };
  }
}

export function createCycleCountSession(input: {
  existing: CycleCountSession[];
  warehouseId: string;
  type: CycleCountType;
  createdBy: string;
  categoryFilter?: string | null;
  binFilter?: string | null;
  lines: Array<{
    partId: string;
    partNumber: string;
    description: string;
    binLocationId: string | null;
    locationCode: string;
    expectedQty: number;
  }>;
}): CycleCountSession {
  return {
    id: `cc-${Date.now()}`,
    countNumber: nextCycleCountNumber(input.existing),
    warehouseId: input.warehouseId,
    type: input.type,
    status: "IN_PROGRESS",
    categoryFilter: input.categoryFilter ?? null,
    binFilter: input.binFilter ?? null,
    lines: input.lines.map(
      (l, i): CycleCountLine => ({
        id: `ccl-${Date.now()}-${i}`,
        ...l,
        actualQty: null,
        variance: null,
        reason: "",
      }),
    ),
    createdBy: input.createdBy,
    approvedBy: null,
    scheduledAt: new Date().toISOString(),
    completedAt: null,
    notes: "",
  };
}

export function applyCycleCountActuals(
  session: CycleCountSession,
  updates: Array<{ lineId: string; actualQty: number; reason?: string }>,
): CycleCountSession {
  return {
    ...session,
    lines: session.lines.map((l) => {
      const u = updates.find((x) => x.lineId === l.id);
      if (!u) return l;
      return {
        ...l,
        actualQty: u.actualQty,
        variance: u.actualQty - l.expectedQty,
        reason: u.reason ?? l.reason,
      };
    }),
  };
}

export function buildTruckRestockLines(input: {
  catalog: PartCatalogItem[];
  truckBalances: StockBalance[];
}): TruckRestockLine[] {
  const balByPart = new Map(input.truckBalances.map((b) => [b.partId, b]));
  const lines: TruckRestockLine[] = [];

  for (const [partNumber, recommended] of Object.entries(TRUCK_RECOMMENDED_STOCK)) {
    const part = input.catalog.find((p) => p.partNumber === partNumber);
    if (!part || part.status !== "ACTIVE") continue;
    const bal = balByPart.get(part.id);
    const current = bal ? quantityAvailable(bal) : 0;
    const missing = Math.max(0, recommended - current);
    if (missing === 0 && current >= recommended) {
      // still include for visibility when critical
      if (!TRUCK_CRITICAL_PARTS.includes(partNumber)) continue;
    }
    lines.push({
      id: `trsl-${part.id}`,
      partId: part.id,
      partNumber: part.partNumber,
      description: part.description,
      currentQty: current,
      recommendedQty: recommended,
      missingQty: missing,
      critical: TRUCK_CRITICAL_PARTS.includes(partNumber),
      fastMoving: TRUCK_FAST_MOVING.includes(partNumber),
      emergencyKit: TRUCK_EMERGENCY_KIT.includes(partNumber),
      consumable: TRUCK_CONSUMABLES.includes(partNumber),
    });
  }

  return lines.sort((a, b) => {
    if (a.critical !== b.critical) return a.critical ? -1 : 1;
    return b.missingQty - a.missingQty;
  });
}

export function createTruckRestockRequest(input: {
  existing: TruckRestockRequest[];
  truckLocationId: string;
  truckName: string;
  technician: string;
  sourceWarehouseId: string;
  createdBy: string;
  lines: TruckRestockLine[];
  notes?: string;
}): TruckRestockRequest {
  return {
    id: `trs-${Date.now()}`,
    requestNumber: nextRestockNumber(input.existing),
    truckLocationId: input.truckLocationId,
    truckName: input.truckName,
    technician: input.technician,
    sourceWarehouseId: input.sourceWarehouseId,
    status: "SUBMITTED",
    lines: input.lines.filter((l) => l.missingQty > 0),
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    completedAt: null,
    notes: input.notes ?? "",
  };
}

export function createWarehouseAudit(input: {
  technician: string;
  warehouseId: string | null;
  inventoryItemId?: string | null;
  partNumber?: string | null;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  reason: string;
  referenceNumber?: string | null;
  sourceModule: string;
  ipAddress?: string;
  device?: string;
}): WarehouseAuditEntry {
  const before = input.quantityBefore ?? null;
  const after = input.quantityAfter ?? null;
  return {
    id: `waudit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    technician: input.technician,
    warehouseId: input.warehouseId,
    inventoryItemId: input.inventoryItemId ?? null,
    partNumber: input.partNumber ?? null,
    quantityBefore: before,
    quantityAfter: after,
    adjustment:
      before != null && after != null ? after - before : null,
    reason: input.reason,
    referenceNumber: input.referenceNumber ?? null,
    sourceModule: input.sourceModule,
    ipAddress: input.ipAddress ?? "0.0.0.0",
    device: input.device ?? "web",
  };
}
