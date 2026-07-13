import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRoute,
  getDefaultPermissionsForRole,
  hasMatrixPermission,
} from "@/lib/auth/permissions";

describe("maintenance dashboard permissions", () => {
  it("allows technicians to view fleet maintenance and complete work", () => {
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_FLEET_MAINTENANCE"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "COMPLETE_MAINTENANCE"),
      true,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "ENTER_COPY_COUNT"),
      true,
    );
  });

  it("restricts scheduling and export to managers/admins", () => {
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "SCHEDULE_MAINTENANCE"),
      false,
    );
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "EXPORT_MAINTENANCE"),
      false,
    );
    assert.equal(
      hasMatrixPermission("SERVICE_MANAGER", "SCHEDULE_MAINTENANCE"),
      true,
    );
    assert.equal(
      hasMatrixPermission("SERVICE_MANAGER", "ASSIGN_MAINTENANCE"),
      true,
    );
    assert.equal(
      hasMatrixPermission("ADMIN", "EXPORT_MAINTENANCE"),
      true,
    );
  });

  it("guards /maintenance route with VIEW_FLEET_MAINTENANCE", () => {
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/maintenance"), true);
    // Patch 42: customer viewers use /portal/maintenance, not internal fleet maintenance
    assert.equal(canAccessRoute("CUSTOMER_VIEWER", "/maintenance"), false);
    assert.equal(canAccessRoute("CUSTOMER_VIEWER", "/portal/maintenance"), true);
    const warehouse = getDefaultPermissionsForRole("WAREHOUSE_MANAGER");
    assert.ok(warehouse.includes("VIEW_FLEET_MAINTENANCE"));
  });
});
