import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApproveCycleCounts,
  canApproveInventoryTransfers,
  canDeleteInventoryRecords,
  canExportInventory,
  canManageWarehouses,
  canPrintInventoryReports,
  canRunReceivingWizard,
  canViewInventoryCosts,
} from "./warehouse-permissions";
import { canAccessRoute, getDefaultPermissionsForRole } from "./permissions";

describe("warehouse permissions (Patch 43)", () => {
  it("maps warehouse manager capabilities", () => {
    assert.equal(canManageWarehouses("WAREHOUSE_MANAGER"), true);
    assert.equal(canApproveInventoryTransfers("WAREHOUSE_MANAGER"), true);
    assert.equal(canViewInventoryCosts("WAREHOUSE_MANAGER"), true);
    assert.equal(canExportInventory("WAREHOUSE_MANAGER"), true);
    assert.equal(canPrintInventoryReports("WAREHOUSE_MANAGER"), true);
    assert.equal(canApproveCycleCounts("WAREHOUSE_MANAGER"), true);
    assert.equal(canRunReceivingWizard("WAREHOUSE_MANAGER"), true);
    assert.equal(canDeleteInventoryRecords("WAREHOUSE_MANAGER"), false);
  });

  it("restricts technicians from warehouse admin actions", () => {
    assert.equal(canManageWarehouses("FIELD_TECHNICIAN"), false);
    assert.equal(canRunReceivingWizard("FIELD_TECHNICIAN"), false);
    assert.equal(canDeleteInventoryRecords("ADMIN"), true);
  });

  it("keeps /inventory routes under VIEW_INVENTORY", () => {
    assert.equal(canAccessRoute("WAREHOUSE_MANAGER", "/inventory/warehouses"), true);
    assert.equal(canAccessRoute("WAREHOUSE_MANAGER", "/inventory/receiving"), true);
    assert.equal(canAccessRoute("CUSTOMER_VIEWER", "/inventory/warehouses"), false);
    const perms = getDefaultPermissionsForRole("WAREHOUSE_MANAGER");
    assert.ok(perms.includes("MANAGE_WAREHOUSES"));
    assert.ok(perms.includes("APPROVE_INVENTORY_TRANSFERS"));
  });
});
