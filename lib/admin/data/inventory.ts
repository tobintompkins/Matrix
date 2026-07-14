/**
 * Patch 49B — Parts & inventory administrative operations.
 */

import {
  getCatalogPart,
  listBalances,
  listCatalog,
  listLocations,
  listTransactions,
  postTransaction,
} from "@/lib/inventory/enterprise-repository";
import type { PartCatalogItem } from "@/lib/inventory/enterprise-types";
import { getRelationshipImpact } from "./relationship-impact";
import {
  archiveOperationalRecord,
  getOperationalState,
  unarchiveOperationalRecord,
} from "./operational-state";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

const PART_META_KEY = "matrix.admin.part-meta.v1";

type PartMetaPatch = Partial<
  Pick<
    PartCatalogItem,
    | "partNumber"
    | "description"
    | "category"
    | "unitOfMeasure"
    | "preferredVendorId"
    | "manufacturerPartNumber"
    | "status"
    | "assembly"
    | "printerModels"
  >
> & { updatedAtVersion: number; updatedAt: string };

let partMeta: Record<string, PartMetaPatch> | null = null;

function readPartMeta(): Record<string, PartMetaPatch> {
  if (partMeta) return partMeta;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(PART_META_KEY);
      if (raw) {
        partMeta = JSON.parse(raw) as Record<string, PartMetaPatch>;
        return partMeta;
      }
    } catch {
      /* ignore */
    }
  }
  partMeta = {};
  return partMeta;
}

function writePartMeta(next: Record<string, PartMetaPatch>) {
  partMeta = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PART_META_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export type AdminInventoryActor = {
  userId: string;
  displayName: string;
  organizationId?: string;
};

export function listAdminParts(input: {
  search?: string;
  status?: "ACTIVE" | "INACTIVE" | "ARCHIVED" | "ALL";
  page?: number;
  pageSize?: number;
}): {
  items: Array<PartCatalogItem & { recordState: string }>;
  total: number;
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const catalog = listCatalog(input.search, 1, 5000);
  let items = catalog.items.map((p) => {
    const meta = readPartMeta()[p.id];
    const state = getOperationalState("PART", p.id);
    const merged = meta ? ({ ...p, ...meta } as PartCatalogItem) : p;
    return {
      ...merged,
      recordState:
        state?.lifecycle === "ARCHIVED"
          ? "ARCHIVED"
          : merged.status === "INACTIVE"
            ? "INACTIVE"
            : "ACTIVE",
    };
  });

  if (input.status === "ACTIVE") {
    items = items.filter((p) => p.recordState === "ACTIVE");
  } else if (input.status === "INACTIVE") {
    items = items.filter((p) => p.status === "INACTIVE");
  } else if (input.status === "ARCHIVED") {
    items = items.filter((p) => p.recordState === "ARCHIVED");
  }

  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export function updatePartMetadataAsAdmin(
  partId: string,
  patch: Partial<PartCatalogItem>,
  actor: AdminInventoryActor,
  reason: string,
): { ok: true; part: PartCatalogItem } | { ok: false; error: string } {
  const part = getCatalogPart(partId);
  if (!part) return { ok: false, error: "Part not found." };
  if (reason.trim().length < 3) {
    return { ok: false, error: "A reason for change is required." };
  }
  if (
    (patch.partNumber && patch.partNumber !== part.partNumber) ||
    (patch.unitOfMeasure && patch.unitOfMeasure !== part.unitOfMeasure)
  ) {
    if (reason.trim().length < 3) {
      return {
        ok: false,
        error: "A reason is required when changing inventory-driving fields.",
      };
    }
  }

  const existing = readPartMeta()[partId];
  const next: PartMetaPatch = {
    ...existing,
    ...patch,
    updatedAtVersion: (existing?.updatedAtVersion ?? 1) + 1,
    updatedAt: new Date().toISOString(),
  };
  writePartMeta({ ...readPartMeta(), [partId]: next });
  void actor;
  return { ok: true, part: { ...part, ...patch } };
}

export function archivePart(
  partId: string,
  actor: AdminInventoryActor,
  reason: string,
): { ok: true } | { ok: false; error: string } {
  const part = getCatalogPart(partId);
  if (!part) return { ok: false, error: "Part not found." };
  if (reason.trim().length < 3) {
    return { ok: false, error: "An archive reason is required." };
  }
  const overlay = archiveOperationalRecord({
    recordType: "PART",
    recordId: partId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
    reason: reason.trim(),
    organizationId: actor.organizationId ?? DEFAULT_ORG_ID,
    displayName: part.partNumber,
  });
  if (!overlay.ok) return overlay;
  updatePartMetadataAsAdmin(
    partId,
    { status: "INACTIVE" },
    actor,
    reason,
  );
  return { ok: true };
}

export function unarchivePart(
  partId: string,
  actor: AdminInventoryActor,
): { ok: true } | { ok: false; error: string } {
  const overlay = unarchiveOperationalRecord({
    recordType: "PART",
    recordId: partId,
    actorUserId: actor.userId,
    actorName: actor.displayName,
  });
  if (!overlay.ok) return overlay;
  updatePartMetadataAsAdmin(
    partId,
    { status: "ACTIVE" },
    actor,
    "Unarchive part",
  );
  return { ok: true };
}

export function createInventoryCorrection(
  input: {
    partId: string;
    locationId: string;
    previousQuantity: number;
    adjustmentQuantity: number;
    reason: string;
    notes?: string;
  },
  actor: AdminInventoryActor,
):
  | { ok: true; resultingQuantity: number; transactionId: string }
  | { ok: false; error: string } {
  if (input.reason.trim().length < 3) {
    return { ok: false, error: "A correction reason is required." };
  }
  const part = getCatalogPart(input.partId);
  if (!part) return { ok: false, error: "Part not found." };

  const balances = listBalances(input.locationId);
  const balance = balances.find((b) => b.partId === input.partId);
  const current = balance?.quantityOnHand ?? 0;
  if (current !== input.previousQuantity) {
    return {
      ok: false,
      error:
        "This record changed after you opened it. Refresh and review the latest information before continuing.",
    };
  }

  const resulting = current + input.adjustmentQuantity;
  if (resulting < 0) {
    return {
      ok: false,
      error: "Adjustment would result in a negative on-hand quantity.",
    };
  }

  const result = postTransaction({
    type: "ADJUSTMENT",
    partId: input.partId,
    quantity: Math.abs(input.adjustmentQuantity),
    reason: `${input.reason.trim()}${input.notes ? ` — ${input.notes}` : ""}`,
    user: actor.displayName,
    sourceLocationId:
      input.adjustmentQuantity < 0 ? input.locationId : null,
    destinationLocationId:
      input.adjustmentQuantity > 0 ? input.locationId : null,
    setOnHandTo: resulting,
  });

  if (!result.ok || !result.transaction) {
    return {
      ok: false,
      error: result.error ?? "Unable to create inventory correction.",
    };
  }

  return {
    ok: true,
    resultingQuantity: resulting,
    transactionId: result.transaction.id,
  };
}

export function listAdminWarehouses() {
  return listLocations().map((loc) => {
    const stock = listBalances(loc.id).reduce((n, b) => n + b.quantityOnHand, 0);
    const txns = listTransactions(200).filter(
      (t) =>
        t.sourceLocationId === loc.id || t.destinationLocationId === loc.id,
    );
    return {
      ...loc,
      stockOnHand: stock,
      transactionCount: txns.length,
      canDelete: stock === 0 && txns.length === 0,
    };
  });
}

export function canSoftDeletePart(partId: string): boolean {
  return getRelationshipImpact("PART", partId).canSoftDelete;
}

export const INVENTORY_CORRECTION_REASONS = [
  "Physical Count Adjustment",
  "Receiving Correction",
  "Transfer Correction",
  "Damaged Stock",
  "Lost Stock",
  "Duplicate Transaction",
  "Data Import Correction",
  "Other",
] as const;
