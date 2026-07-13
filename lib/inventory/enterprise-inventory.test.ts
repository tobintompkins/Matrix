import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  applyInventoryTransaction,
  buildDashboardMetrics,
  canTransitionPurchaseRequest,
  createPartCatalogItem,
  createReservation,
  nextPurchaseRequestNumber,
  quantityAvailable,
  releaseReservation,
  searchCatalog,
  transitionPurchaseRequest,
  truckStockSummary,
} from "@/lib/inventory";
import {
  canApprovePurchaseRequests,
  canConsumeInventory,
  canReceiveInventory,
  canViewInventory,
} from "@/lib/auth/inventory-permissions";
import type {
  InventoryTransaction,
  PartCatalogItem,
  PurchaseRequest,
  StockBalance,
} from "@/lib/inventory/enterprise-types";
import { ENTERPRISE_CATALOG } from "@/lib/inventory/enterprise-seed";
import {
  lookupGuidedDiagramPart,
  processScan,
  resetEnterpriseInventoryForTests,
} from "@/lib/inventory/enterprise-repository";

function samplePart(): PartCatalogItem {
  return { ...ENTERPRISE_CATALOG[0] };
}

function emptyBalance(part: PartCatalogItem, locationId: string, onHand = 10): StockBalance {
  return {
    id: `stk-${locationId}`,
    partId: part.id,
    partNumber: part.partNumber,
    locationId,
    quantityOnHand: onHand,
    quantityReserved: 0,
    quantityOnOrder: 0,
    quantityCommitted: 0,
    minimumQuantity: 2,
    maximumQuantity: 20,
    reorderPoint: 3,
    reorderQuantity: 5,
    lastCountDate: null,
    lastUpdated: new Date().toISOString(),
  };
}

describe("enterprise inventory — part creation", () => {
  it("creates a unique part", () => {
    const result = createPartCatalogItem(
      {
        partNumber: "NEW-100",
        manufacturerPartNumber: "MFG-100",
        description: "Test Part",
        category: "Test",
        subcategory: "Unit",
        printerModels: ["SF9450"],
        assembly: "Feed",
        diagramCalloutNumber: "99",
        unitOfMeasure: "EA",
        preferredVendorId: null,
        alternateVendorIds: [],
        cost: 10,
        listPrice: 20,
        weight: 1,
        dimensions: "1x1x1",
        leadTimeDays: 2,
        warranty: "None",
        photoUrl: null,
        technicalDocuments: [],
        safetyNotes: "",
        status: "ACTIVE",
        barcode: "NEW100",
        qrCode: "QR-NEW-100",
      },
      ENTERPRISE_CATALOG,
    );
    assert.equal(result.ok, true);
    assert.equal(result.part?.partNumber, "NEW-100");
  });

  it("rejects duplicate part numbers", () => {
    const result = createPartCatalogItem(
      {
        ...ENTERPRISE_CATALOG[0],
        partNumber: ENTERPRISE_CATALOG[0].partNumber,
      },
      ENTERPRISE_CATALOG,
    );
    assert.equal(result.ok, false);
  });
});

describe("enterprise inventory — transactions & calculations", () => {
  it("computes available as on-hand minus reserved", () => {
    const bal = emptyBalance(samplePart(), "loc-main", 10);
    bal.quantityReserved = 3;
    assert.equal(quantityAvailable(bal), 7);
  });

  it("receives inventory into a location", () => {
    const part = samplePart();
    const balances = [emptyBalance(part, "loc-main", 5)];
    const result = applyInventoryTransaction(balances, {
      type: "RECEIVE",
      part,
      quantity: 4,
      reason: "PO receive",
      user: "Warehouse",
      destinationLocationId: "loc-main",
    });
    assert.equal(result.ok, true);
    assert.equal(result.transaction?.newOnHand, 9);
    assert.equal(result.transaction?.type, "RECEIVE");
  });

  it("blocks consume when available is insufficient", () => {
    const part = samplePart();
    const bal = emptyBalance(part, "loc-truck", 5);
    bal.quantityReserved = 4;
    const result = applyInventoryTransaction([bal], {
      type: "CONSUME",
      part,
      quantity: 2,
      reason: "WO",
      user: "Tech",
      sourceLocationId: "loc-truck",
    });
    assert.equal(result.ok, false);
  });

  it("transfers between locations", () => {
    const part = samplePart();
    const balances = [
      emptyBalance(part, "loc-main", 10),
      emptyBalance(part, "loc-truck", 1),
    ];
    const result = applyInventoryTransaction(balances, {
      type: "TRANSFER",
      part,
      quantity: 3,
      reason: "Restock truck",
      user: "Warehouse",
      sourceLocationId: "loc-main",
      destinationLocationId: "loc-truck",
    });
    assert.equal(result.ok, true);
    const main = result.balances.find((b) => b.locationId === "loc-main");
    const truck = result.balances.find((b) => b.locationId === "loc-truck");
    assert.equal(main?.quantityOnHand, 7);
    assert.equal(truck?.quantityOnHand, 4);
  });

  it("builds dashboard metrics", () => {
    const part = samplePart();
    const balances = [emptyBalance(part, "loc-main", 0)];
    balances[0].quantityOnOrder = 5;
    const txns: InventoryTransaction[] = [
      {
        id: "t1",
        type: "CONSUME",
        partId: part.id,
        partNumber: part.partNumber,
        quantity: 2,
        previousOnHand: 5,
        newOnHand: 3,
        reason: "use",
        user: "Tech",
        occurredAt: "2026-07-01T00:00:00.000Z",
        workOrderId: null,
        purchaseRequestId: null,
        sourceLocationId: "loc-main",
        destinationLocationId: null,
      },
    ];
    const metrics = buildDashboardMetrics({
      catalog: [part],
      balances,
      transactions: txns,
    });
    assert.equal(metrics.totalParts, 1);
    assert.equal(metrics.outOfStock, 1);
    assert.equal(metrics.backordered, 1);
    assert.equal(metrics.mostUsed[0]?.quantity, 2);
  });
});

describe("enterprise inventory — reservations", () => {
  it("reserves without reducing on-hand", () => {
    const part = samplePart();
    const balances = [emptyBalance(part, "loc-main", 10)];
    const result = createReservation(balances, [], {
      part,
      locationId: "loc-main",
      quantity: 3,
      purpose: "WORK_ORDER",
      relatedRecordId: "wo-1",
      relatedRecordType: "WORK_ORDER",
      reservedBy: "Tech",
    });
    assert.equal(result.ok, true);
    assert.equal(result.balances[0].quantityOnHand, 10);
    assert.equal(result.balances[0].quantityReserved, 3);
    assert.equal(quantityAvailable(result.balances[0]), 7);
  });

  it("releases reserved quantity", () => {
    const part = samplePart();
    const balances = [emptyBalance(part, "loc-main", 10)];
    balances[0].quantityReserved = 2;
    const reservations = [
      {
        id: "rsv-1",
        partId: part.id,
        partNumber: part.partNumber,
        locationId: "loc-main",
        quantity: 2,
        purpose: "SCHEDULED_PM" as const,
        relatedRecordId: "pm-1",
        relatedRecordType: "PM",
        reservedBy: "Mgr",
        reservedAt: new Date().toISOString(),
        status: "ACTIVE" as const,
      },
    ];
    const result = releaseReservation(balances, reservations, "rsv-1");
    assert.equal(result.ok, true);
    assert.equal(result.balances[0].quantityReserved, 0);
    assert.equal(result.reservations[0].status, "RELEASED");
  });
});

describe("enterprise inventory — truck stock", () => {
  it("summarizes truck stock buckets", () => {
    const part = samplePart();
    const low = emptyBalance(part, "loc-truck-alex", 2);
    low.reorderPoint = 3;
    const summary = truckStockSummary([low], "loc-truck-alex", []);
    assert.equal(summary.current.length, 1);
    assert.equal(summary.lowStock.length, 1);
  });
});

describe("enterprise inventory — purchase requests", () => {
  it("numbers purchase requests sequentially", () => {
    const year = new Date().getFullYear();
    const existing: PurchaseRequest[] = [
      {
        id: "1",
        requestNumber: `PR-${year}-000003`,
        requester: "A",
        approver: "",
        priority: "NORMAL",
        vendorId: null,
        vendorName: "",
        lines: [],
        justification: "",
        expectedDelivery: null,
        status: "DRAFT",
        createdAt: "",
        updatedAt: "",
      },
    ];
    assert.equal(nextPurchaseRequestNumber(existing), `PR-${year}-000004`);
  });

  it("enforces purchase request workflow", () => {
    assert.equal(canTransitionPurchaseRequest("DRAFT", "PENDING_APPROVAL"), true);
    assert.equal(canTransitionPurchaseRequest("DRAFT", "RECEIVED"), false);
    const draft: PurchaseRequest = {
      id: "pr",
      requestNumber: "PR-2026-000010",
      requester: "A",
      approver: "",
      priority: "HIGH",
      vendorId: null,
      vendorName: "",
      lines: [],
      justification: "need",
      expectedDelivery: null,
      status: "DRAFT",
      createdAt: "",
      updatedAt: "",
    };
    const next = transitionPurchaseRequest(draft, "PENDING_APPROVAL");
    assert.equal(next.ok, true);
    assert.equal(next.request.status, "PENDING_APPROVAL");
  });
});

describe("enterprise inventory — guided diagram + scan", () => {
  beforeEach(() => {
    resetEnterpriseInventoryForTests();
  });

  it("looks up guided diagram part by callout", () => {
    const hit = lookupGuidedDiagramPart({
      printerModel: "GD9630",
      assembly: "Feed Unit",
      calloutNumber: "12",
      partNumber: "RIS-GD-FU-1201",
      truckLocationId: "loc-truck-alex",
    });
    assert.ok(hit);
    assert.equal(hit?.partNumber, "RIS-GD-FU-1201");
    assert.ok((hit?.warehouseQuantity ?? 0) >= 0);
  });

  it("processes barcode lookup scan", () => {
    const result = processScan({
      code: "01412345001",
      action: "LOOKUP",
      user: "Tech",
    });
    assert.equal(result.ok, true);
    assert.equal(result.part?.partNumber, "014-12345");
  });
});

describe("enterprise inventory — search pagination", () => {
  it("paginates catalog search", () => {
    const page1 = searchCatalog(ENTERPRISE_CATALOG, "", { page: 1, pageSize: 3 });
    assert.equal(page1.items.length, 3);
    assert.ok(page1.total >= 3);
  });
});

describe("enterprise inventory — permissions", () => {
  it("maps technician / warehouse / manager capabilities", () => {
    assert.equal(canViewInventory("FIELD_TECHNICIAN"), true);
    assert.equal(canConsumeInventory("FIELD_TECHNICIAN"), true);
    assert.equal(canReceiveInventory("FIELD_TECHNICIAN"), false);
    assert.equal(canReceiveInventory("WAREHOUSE_MANAGER"), true);
    assert.equal(canApprovePurchaseRequests("SERVICE_MANAGER"), true);
    assert.equal(canApprovePurchaseRequests("FIELD_TECHNICIAN"), false);
  });
});

describe("enterprise inventory — audit fields on transactions", () => {
  it("records previous and new quantities", () => {
    const part = samplePart();
    const result = applyInventoryTransaction([emptyBalance(part, "loc-main", 8)], {
      type: "ADJUSTMENT",
      part,
      quantity: 0,
      setOnHandTo: 6,
      reason: "Cycle variance",
      user: "Auditor",
      sourceLocationId: "loc-main",
    });
    assert.equal(result.ok, true);
    assert.equal(result.transaction?.previousOnHand, 8);
    assert.equal(result.transaction?.newOnHand, 6);
    assert.equal(result.transaction?.user, "Auditor");
  });
});
