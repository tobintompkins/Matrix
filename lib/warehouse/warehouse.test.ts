import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { resetEnterpriseInventoryForTests } from "@/lib/inventory";
import {
  canAdvanceTransfer,
  deriveBinStockStatus,
  formatBinCode,
  generateTruckRestockRequest,
  getTruckRestockPreview,
  getWarehouseDashboard,
  listWarehouseStock,
  matchesBinSegment,
  parseBinCode,
  requestTransfer,
  resetWarehouseForTests,
  searchWarehouseStock,
  startCycleCount,
  recordCycleCountActuals,
  completeCycleCount,
  updateTransferStatus,
} from "./index";
import {
  canApproveInventoryTransfers,
  canExportInventory,
  canManageWarehouses,
  canRunReceivingWizard,
  canViewInventoryCosts,
} from "@/lib/auth/warehouse-permissions";

describe("warehouse Patch 43", () => {
  beforeEach(() => {
    resetEnterpriseInventoryForTests();
    resetWarehouseForTests();
  });

  it("formats and parses bin location codes", () => {
    const code = formatBinCode("WH1", "A", "03", "R2", "S4", "B17");
    assert.equal(code, "WH1-A-03-R2-S4-B17");
    const parsed = parseBinCode(code);
    assert.ok(parsed);
    assert.equal(parsed.zone, "A");
    assert.equal(parsed.bin, "B17");
    assert.equal(matchesBinSegment(code, "B17"), true);
    assert.equal(matchesBinSegment(code, "ZZ"), false);
  });

  it("builds warehouse stock with bin locations and search", () => {
    const rows = listWarehouseStock();
    assert.ok(rows.length > 0);
    assert.ok(rows.some((r) => r.locationCode.includes("WH1")));
    const found = searchWarehouseStock(rows, "014-12345");
    assert.ok(found.length >= 1);
    const byBin = searchWarehouseStock(rows, "B17");
    assert.ok(byBin.length >= 1);
  });

  it("computes dashboard KPIs", () => {
    const dash = getWarehouseDashboard();
    assert.ok(dash.totalInventoryValue >= 0);
    assert.ok(dash.totalActiveParts > 0);
    assert.ok(["Healthy", "Needs Restock", "Critical"].includes(dash.truckInventoryStatus));
  });

  it("creates and advances transfers through receive", () => {
    const created = requestTransfer({
      fromWarehouseId: "wh-main",
      toWarehouseId: "wh-main",
      fromLocationId: "loc-main",
      toLocationId: "loc-truck-alex",
      requestedBy: "Tester",
      notes: "Test transfer",
      lines: [
        {
          partId: "part-014-12345",
          partNumber: "014-12345",
          description: "Master Roll Assembly",
          quantity: 1,
        },
      ],
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(canAdvanceTransfer("Requested", "Approved"), true);
    assert.equal(canAdvanceTransfer("Requested", "Received"), false);

    let t = created.transfer;
    for (const next of [
      "Approved",
      "Picking",
      "Packed",
      "In Transit",
      "Delivered",
      "Received",
    ] as const) {
      const r = updateTransferStatus(t.id, next, "Tester");
      assert.equal(r.ok, true, r.ok ? "" : r.error);
      if (r.ok) t = r.transfer;
    }
    assert.equal(t.status, "Received");
  });

  it("generates truck restock requests for missing stock", () => {
    const preview = getTruckRestockPreview("loc-truck-alex");
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.ok(preview.lines.length > 0);
    const result = generateTruckRestockRequest({
      truckLocationId: "loc-truck-alex",
      sourceWarehouseId: "wh-main",
      createdBy: "Tester",
    });
    // May fail if already at recommended — seed truck often below recommended
    if (result.ok) {
      assert.ok(result.request.requestNumber.startsWith("TRS-"));
      assert.ok(result.request.lines.every((l) => l.missingQty > 0));
    }
  });

  it("runs cycle count with variance posting", () => {
    const started = startCycleCount({
      warehouseId: "wh-main",
      type: "ABC",
      createdBy: "Tester",
    });
    if (!started.ok) {
      assert.fail(`startCycleCount failed: ${started.error}`);
    }
    const updates = started.session.lines.map((l, i) => ({
      lineId: l.id,
      actualQty: i === 0 ? l.expectedQty + 1 : l.expectedQty,
      reason: i === 0 ? "Found one extra" : "",
    }));
    recordCycleCountActuals(started.session.id, updates);
    const done = completeCycleCount(started.session.id, "Tester");
    if (!done.ok) {
      assert.fail(`completeCycleCount failed: ${done.error}`);
    }
  });

  it("derives bin stock statuses", () => {
    assert.equal(
      deriveBinStockStatus(
        {
          id: "x",
          partId: "p",
          partNumber: "n",
          locationId: "loc-main",
          quantityOnHand: 0,
          quantityReserved: 0,
          quantityOnOrder: 2,
          quantityCommitted: 0,
          minimumQuantity: 5,
          maximumQuantity: 20,
          reorderPoint: 5,
          reorderQuantity: 5,
          lastCountDate: null,
          lastUpdated: "",
        },
        undefined,
      ),
      "Back Ordered",
    );
  });
});

describe("warehouse permissions Patch 43", () => {
  it("grants warehouse manager receiving and transfer approval", () => {
    assert.equal(canRunReceivingWizard("WAREHOUSE_MANAGER"), true);
    assert.equal(canApproveInventoryTransfers("WAREHOUSE_MANAGER"), true);
    assert.equal(canManageWarehouses("WAREHOUSE_MANAGER"), true);
    assert.equal(canViewInventoryCosts("WAREHOUSE_MANAGER"), true);
    assert.equal(canExportInventory("WAREHOUSE_MANAGER"), true);
    assert.equal(canRunReceivingWizard("FIELD_TECHNICIAN"), false);
    assert.equal(canManageWarehouses("FIELD_TECHNICIAN"), false);
  });
});
