import type {
  InventoryReservation,
  InventoryTransaction,
  InventoryTxnType,
  PartCatalogItem,
  PurchaseRequest,
  PurchaseRequestStatus,
  ReservationPurpose,
  StockBalance,
} from "./enterprise-types";
import { quantityAvailable } from "./enterprise-types";

function nowIso(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function findOrCreateBalance(
  balances: StockBalance[],
  part: PartCatalogItem,
  locationId: string,
): { balances: StockBalance[]; balance: StockBalance } {
  const existing = balances.find(
    (b) => b.partId === part.id && b.locationId === locationId,
  );
  if (existing) return { balances, balance: existing };
  const balance: StockBalance = {
    id: id("stk"),
    partId: part.id,
    partNumber: part.partNumber,
    locationId,
    quantityOnHand: 0,
    quantityReserved: 0,
    quantityOnOrder: 0,
    quantityCommitted: 0,
    minimumQuantity: 0,
    maximumQuantity: 0,
    reorderPoint: 0,
    reorderQuantity: 0,
    lastCountDate: null,
    lastUpdated: nowIso(),
  };
  return { balances: [...balances, balance], balance };
}

export type ApplyTxnInput = {
  type: InventoryTxnType;
  part: PartCatalogItem;
  quantity: number;
  reason: string;
  user: string;
  workOrderId?: string | null;
  purchaseRequestId?: string | null;
  sourceLocationId?: string | null;
  destinationLocationId?: string | null;
  /** For CYCLE_COUNT / ADJUSTMENT absolute set */
  setOnHandTo?: number;
};

export type ApplyTxnResult = {
  ok: boolean;
  error?: string;
  balances: StockBalance[];
  transaction?: InventoryTransaction;
};

export function applyInventoryTransaction(
  balances: StockBalance[],
  input: ApplyTxnInput,
): ApplyTxnResult {
  if (input.quantity <= 0 && input.setOnHandTo == null) {
    return { ok: false, error: "Quantity must be positive.", balances };
  }

  const qty = input.quantity;
  let next = [...balances];
  let previousOnHand = 0;
  let newOnHand = 0;
  let sourceId = input.sourceLocationId ?? null;
  let destId = input.destinationLocationId ?? null;

  const patch = (locationId: string, fn: (b: StockBalance) => StockBalance) => {
    const found = findOrCreateBalance(next, input.part, locationId);
    next = found.balances.map((b) =>
      b.partId === input.part.id && b.locationId === locationId ? fn(b) : b,
    );
    return next.find((b) => b.partId === input.part.id && b.locationId === locationId)!;
  };

  switch (input.type) {
    case "RECEIVE":
    case "CUSTOMER_RETURN":
    case "WARRANTY_RETURN":
    case "RETURN": {
      if (!destId) return { ok: false, error: "Destination location required.", balances };
      const b = patch(destId, (bal) => {
        previousOnHand = bal.quantityOnHand;
        newOnHand = bal.quantityOnHand + qty;
        return {
          ...bal,
          quantityOnHand: newOnHand,
          quantityOnOrder: Math.max(0, bal.quantityOnOrder - qty),
          lastUpdated: nowIso(),
        };
      });
      newOnHand = b.quantityOnHand;
      previousOnHand = newOnHand - qty;
      break;
    }
    case "CONSUME":
    case "SCRAP": {
      if (!sourceId) return { ok: false, error: "Source location required.", balances };
      const current = next.find(
        (b) => b.partId === input.part.id && b.locationId === sourceId,
      );
      if (!current || quantityAvailable(current) < qty) {
        return { ok: false, error: "Insufficient available quantity.", balances };
      }
      patch(sourceId, (bal) => {
        previousOnHand = bal.quantityOnHand;
        newOnHand = bal.quantityOnHand - qty;
        return {
          ...bal,
          quantityOnHand: newOnHand,
          lastUpdated: nowIso(),
        };
      });
      break;
    }
    case "TRANSFER": {
      if (!sourceId || !destId) {
        return { ok: false, error: "Source and destination required for transfer.", balances };
      }
      if (sourceId === destId) {
        return { ok: false, error: "Source and destination must differ.", balances };
      }
      const current = next.find(
        (b) => b.partId === input.part.id && b.locationId === sourceId,
      );
      if (!current || quantityAvailable(current) < qty) {
        return { ok: false, error: "Insufficient available quantity at source.", balances };
      }
      patch(sourceId, (bal) => {
        previousOnHand = bal.quantityOnHand;
        newOnHand = bal.quantityOnHand - qty;
        return { ...bal, quantityOnHand: newOnHand, lastUpdated: nowIso() };
      });
      patch(destId, (bal) => ({
        ...bal,
        quantityOnHand: bal.quantityOnHand + qty,
        lastUpdated: nowIso(),
      }));
      break;
    }
    case "ADJUSTMENT":
    case "CYCLE_COUNT": {
      if (!sourceId && !destId) {
        return { ok: false, error: "Location required.", balances };
      }
      const loc = sourceId ?? destId!;
      sourceId = loc;
      destId = loc;
      const target =
        input.setOnHandTo != null ? input.setOnHandTo : undefined;
      if (target == null && input.type === "CYCLE_COUNT") {
        return { ok: false, error: "Cycle count requires counted quantity.", balances };
      }
      patch(loc, (bal) => {
        previousOnHand = bal.quantityOnHand;
        if (target != null) {
          newOnHand = Math.max(0, target);
        } else {
          newOnHand = Math.max(0, bal.quantityOnHand + qty);
        }
        return {
          ...bal,
          quantityOnHand: newOnHand,
          lastCountDate: input.type === "CYCLE_COUNT" ? nowIso().slice(0, 10) : bal.lastCountDate,
          lastUpdated: nowIso(),
        };
      });
      break;
    }
    default:
      return { ok: false, error: `Unsupported transaction type: ${input.type}`, balances };
  }

  const transaction: InventoryTransaction = {
    id: id("txn"),
    type: input.type,
    partId: input.part.id,
    partNumber: input.part.partNumber,
    quantity: input.setOnHandTo != null ? Math.abs(newOnHand - previousOnHand) : qty,
    previousOnHand,
    newOnHand,
    reason: input.reason,
    user: input.user,
    occurredAt: nowIso(),
    workOrderId: input.workOrderId ?? null,
    purchaseRequestId: input.purchaseRequestId ?? null,
    sourceLocationId: sourceId,
    destinationLocationId: destId,
  };

  return { ok: true, balances: next, transaction };
}

export function createReservation(
  balances: StockBalance[],
  reservations: InventoryReservation[],
  input: {
    part: PartCatalogItem;
    locationId: string;
    quantity: number;
    purpose: ReservationPurpose;
    relatedRecordId: string;
    relatedRecordType: string;
    reservedBy: string;
  },
): {
  ok: boolean;
  error?: string;
  balances: StockBalance[];
  reservations: InventoryReservation[];
  reservation?: InventoryReservation;
} {
  if (input.quantity <= 0) {
    return { ok: false, error: "Quantity must be positive.", balances, reservations };
  }
  const balance = balances.find(
    (b) => b.partId === input.part.id && b.locationId === input.locationId,
  );
  if (!balance || quantityAvailable(balance) < input.quantity) {
    return {
      ok: false,
      error: "Insufficient available quantity to reserve.",
      balances,
      reservations,
    };
  }
  const nextBalances = balances.map((b) =>
    b.id === balance.id
      ? {
          ...b,
          quantityReserved: b.quantityReserved + input.quantity,
          lastUpdated: nowIso(),
        }
      : b,
  );
  const reservation: InventoryReservation = {
    id: id("rsv"),
    partId: input.part.id,
    partNumber: input.part.partNumber,
    locationId: input.locationId,
    quantity: input.quantity,
    purpose: input.purpose,
    relatedRecordId: input.relatedRecordId,
    relatedRecordType: input.relatedRecordType,
    reservedBy: input.reservedBy,
    reservedAt: nowIso(),
    status: "ACTIVE",
  };
  return {
    ok: true,
    balances: nextBalances,
    reservations: [reservation, ...reservations],
    reservation,
  };
}

export function releaseReservation(
  balances: StockBalance[],
  reservations: InventoryReservation[],
  reservationId: string,
): {
  ok: boolean;
  error?: string;
  balances: StockBalance[];
  reservations: InventoryReservation[];
} {
  const rsv = reservations.find((r) => r.id === reservationId);
  if (!rsv || rsv.status !== "ACTIVE") {
    return { ok: false, error: "Active reservation not found.", balances, reservations };
  }
  const nextBalances = balances.map((b) =>
    b.partId === rsv.partId && b.locationId === rsv.locationId
      ? {
          ...b,
          quantityReserved: Math.max(0, b.quantityReserved - rsv.quantity),
          lastUpdated: nowIso(),
        }
      : b,
  );
  return {
    ok: true,
    balances: nextBalances,
    reservations: reservations.map((r) =>
      r.id === reservationId ? { ...r, status: "RELEASED" as const } : r,
    ),
  };
}

export function consumeReservation(
  balances: StockBalance[],
  reservations: InventoryReservation[],
  reservationId: string,
  user: string,
  workOrderId?: string,
): {
  ok: boolean;
  error?: string;
  balances: StockBalance[];
  reservations: InventoryReservation[];
  transaction?: InventoryTransaction;
} {
  const rsv = reservations.find((r) => r.id === reservationId);
  if (!rsv || rsv.status !== "ACTIVE") {
    return { ok: false, error: "Active reservation not found.", balances, reservations };
  }
  const partStub: PartCatalogItem = {
    id: rsv.partId,
    partNumber: rsv.partNumber,
    manufacturerPartNumber: "",
    description: "",
    category: "",
    subcategory: "",
    printerModels: [],
    assembly: "",
    diagramCalloutNumber: "",
    unitOfMeasure: "EA",
    preferredVendorId: null,
    alternateVendorIds: [],
    cost: 0,
    listPrice: 0,
    weight: null,
    dimensions: "",
    leadTimeDays: 0,
    warranty: "",
    photoUrl: null,
    technicalDocuments: [],
    safetyNotes: "",
    status: "ACTIVE",
    barcode: "",
    qrCode: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  // Release reserved qty first, then consume from on-hand
  const released = releaseReservation(balances, reservations, reservationId);
  if (!released.ok) return released;

  const consumed = applyInventoryTransaction(released.balances, {
    type: "CONSUME",
    part: partStub,
    quantity: rsv.quantity,
    reason: `Consume reservation ${reservationId}`,
    user,
    workOrderId: workOrderId ?? rsv.relatedRecordId,
    sourceLocationId: rsv.locationId,
  });
  if (!consumed.ok) {
    return {
      ok: false,
      error: consumed.error,
      balances,
      reservations,
    };
  }

  return {
    ok: true,
    balances: consumed.balances,
    reservations: released.reservations.map((r) =>
      r.id === reservationId ? { ...r, status: "CONSUMED" as const } : r,
    ),
    transaction: consumed.transaction,
  };
}

const PR_FLOW: Record<PurchaseRequestStatus, PurchaseRequestStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED", "DRAFT"],
  APPROVED: ["ORDERED", "CANCELLED"],
  ORDERED: ["RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
};

export function canTransitionPurchaseRequest(
  from: PurchaseRequestStatus,
  to: PurchaseRequestStatus,
): boolean {
  return PR_FLOW[from].includes(to);
}

export function transitionPurchaseRequest(
  request: PurchaseRequest,
  to: PurchaseRequestStatus,
  approver?: string,
): { ok: boolean; error?: string; request: PurchaseRequest } {
  if (!canTransitionPurchaseRequest(request.status, to)) {
    return {
      ok: false,
      error: `Cannot move from ${request.status} to ${to}.`,
      request,
    };
  }
  return {
    ok: true,
    request: {
      ...request,
      status: to,
      approver: approver ?? request.approver,
      updatedAt: nowIso(),
    },
  };
}

export function nextPurchaseRequestNumber(existing: PurchaseRequest[]): string {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;
  let max = 0;
  for (const r of existing) {
    if (r.requestNumber.startsWith(prefix)) {
      const n = Number(r.requestNumber.slice(prefix.length));
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

export function createPartCatalogItem(
  input: Omit<PartCatalogItem, "id" | "createdAt" | "updatedAt"> & { id?: string },
  existing: PartCatalogItem[],
): { ok: boolean; error?: string; part?: PartCatalogItem } {
  if (!input.partNumber.trim()) {
    return { ok: false, error: "Part number is required." };
  }
  if (existing.some((p) => p.partNumber.toLowerCase() === input.partNumber.toLowerCase())) {
    return { ok: false, error: "Part number must be unique." };
  }
  const ts = nowIso();
  return {
    ok: true,
    part: {
      ...input,
      id: input.id ?? id("part"),
      partNumber: input.partNumber.trim(),
      createdAt: ts,
      updatedAt: ts,
    },
  };
}
