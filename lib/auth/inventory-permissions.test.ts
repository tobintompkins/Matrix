import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAdjustInventory,
  canApprovePurchaseRequests,
  canConfigureInventory,
  canConsumeInventory,
  canCountTruckInventory,
  canReceiveInventory,
  canRequestParts,
  canReserveInventory,
  canTransferInventory,
  canViewInventory,
  canViewInventoryReports,
} from "./inventory-permissions";
import { hasMatrixPermission } from "./permissions";

describe("inventory permissions (Patch 38)", () => {
  it("gives technicians view, consume, count, and request", () => {
    assert.equal(canViewInventory("FIELD_TECHNICIAN"), true);
    assert.equal(canConsumeInventory("FIELD_TECHNICIAN"), true);
    assert.equal(canCountTruckInventory("FIELD_TECHNICIAN"), true);
    assert.equal(canRequestParts("FIELD_TECHNICIAN"), true);
    assert.equal(canReceiveInventory("FIELD_TECHNICIAN"), false);
    assert.equal(canApprovePurchaseRequests("FIELD_TECHNICIAN"), false);
  });

  it("gives warehouse receive/transfer/adjust", () => {
    assert.equal(canReceiveInventory("WAREHOUSE_MANAGER"), true);
    assert.equal(canTransferInventory("WAREHOUSE_MANAGER"), true);
    assert.equal(canAdjustInventory("WAREHOUSE_MANAGER"), true);
    assert.equal(canReserveInventory("WAREHOUSE_MANAGER"), true);
  });

  it("gives managers approve and configure", () => {
    assert.equal(canApprovePurchaseRequests("SERVICE_MANAGER"), true);
    assert.equal(canViewInventoryReports("SERVICE_MANAGER"), true);
    assert.equal(canConfigureInventory("SERVICE_MANAGER"), true);
  });

  it("gives administrators full inventory access", () => {
    assert.equal(hasMatrixPermission("ADMIN", "MANAGE_INVENTORY_SETTINGS"), true);
    assert.equal(hasMatrixPermission("SUPER_ADMIN", "ADJUST_INVENTORY"), true);
    assert.equal(canConfigureInventory("ADMIN"), true);
  });
});
