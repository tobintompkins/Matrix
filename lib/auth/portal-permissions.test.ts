import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessPortal,
  canAdministerPortal,
  canManagePortalUsers,
} from "./portal-permissions";
import { canAccessRoute, hasMatrixPermission } from "./permissions";

describe("portal permissions (Patch 42)", () => {
  it("grants portal access to customer roles", () => {
    assert.equal(canAccessPortal("CUSTOMER_ADMIN"), true);
    assert.equal(canAccessPortal("CUSTOMER_MANAGER"), true);
    assert.equal(canAccessPortal("CUSTOMER_USER"), true);
    assert.equal(canAccessPortal("CUSTOMER_VIEWER"), true);
    assert.equal(canManagePortalUsers("CUSTOMER_ADMIN"), true);
    assert.equal(canManagePortalUsers("CUSTOMER_USER"), false);
  });

  it("guards /portal and admin portal routes", () => {
    assert.equal(canAccessRoute("CUSTOMER_ADMIN", "/portal/dashboard"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/portal/dashboard"), false);
    assert.equal(canAccessRoute("SERVICE_MANAGER", "/admin/portal"), true);
    assert.equal(canAccessRoute("CUSTOMER_VIEWER", "/admin/portal"), false);
    assert.equal(hasMatrixPermission("ADMIN", "ADMINISTER_CUSTOMER_PORTAL"), true);
    assert.equal(canAdministerPortal("ADMIN"), true);
  });
});
