import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canConfigureOfflinePolicies,
  canDownloadOfflinePackages,
  canResolveFieldConflicts,
  canSyncFieldQueue,
  canUseOfflineField,
  canViewField,
  canViewOtherTechniciansField,
} from "./field-permissions";
import { canAccessRoute, hasMatrixPermission } from "./permissions";

describe("field permissions (Patch 39)", () => {
  it("allows technicians to use field offline features", () => {
    assert.equal(canViewField("FIELD_TECHNICIAN"), true);
    assert.equal(canUseOfflineField("FIELD_TECHNICIAN"), true);
    assert.equal(canDownloadOfflinePackages("FIELD_TECHNICIAN"), true);
    assert.equal(canSyncFieldQueue("FIELD_TECHNICIAN"), true);
    assert.equal(canResolveFieldConflicts("FIELD_TECHNICIAN"), false);
    assert.equal(canConfigureOfflinePolicies("FIELD_TECHNICIAN"), false);
  });

  it("allows managers to resolve conflicts and view all technicians", () => {
    assert.equal(canResolveFieldConflicts("SERVICE_MANAGER"), true);
    assert.equal(canViewOtherTechniciansField("SERVICE_MANAGER"), true);
    assert.equal(canConfigureOfflinePolicies("SERVICE_MANAGER"), true);
  });

  it("guards /field route", () => {
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/field"), true);
    assert.equal(canAccessRoute("CUSTOMER_VIEWER", "/field"), false);
    assert.equal(hasMatrixPermission("ADMIN", "CONFIGURE_OFFLINE_POLICIES"), true);
  });
});
