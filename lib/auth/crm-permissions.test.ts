import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canManageAssets,
  canManageContacts,
  canManageContracts,
  canManageCustomers,
  canManageSites,
  canManageWarranties,
  canUpdateAssetServiceInfo,
  canViewCustomers,
  canViewSites,
} from "./crm-permissions";
import { canAccessRoute, hasMatrixPermission } from "./permissions";

describe("CRM permissions (Patch 40)", () => {
  it("allows technicians to view customers/sites and update service info", () => {
    assert.equal(canViewCustomers("FIELD_TECHNICIAN"), true);
    assert.equal(canViewSites("FIELD_TECHNICIAN"), true);
    assert.equal(canUpdateAssetServiceInfo("FIELD_TECHNICIAN"), true);
    assert.equal(canManageCustomers("FIELD_TECHNICIAN"), false);
    assert.equal(canManageContracts("FIELD_TECHNICIAN"), false);
    assert.equal(canManageWarranties("FIELD_TECHNICIAN"), false);
  });

  it("allows managers full CRM management", () => {
    assert.equal(canManageCustomers("SERVICE_MANAGER"), true);
    assert.equal(canManageSites("SERVICE_MANAGER"), true);
    assert.equal(canManageContacts("SERVICE_MANAGER"), true);
    assert.equal(canManageContracts("SERVICE_MANAGER"), true);
    assert.equal(canManageWarranties("SERVICE_MANAGER"), true);
    assert.equal(canManageAssets("SERVICE_MANAGER"), true);
  });

  it("guards customer routes and grants admins all CRM permissions", () => {
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/customers"), true);
    assert.equal(canAccessRoute("CUSTOMER_VIEWER", "/customers"), false);
    assert.equal(canAccessRoute("SERVICE_MANAGER", "/add-customer"), true);
    assert.equal(hasMatrixPermission("ADMIN", "MANAGE_CUSTOMERS"), true);
    assert.equal(hasMatrixPermission("ADMIN", "MANAGE_ASSETS"), true);
  });
});
