import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRoute,
  getDefaultPermissionsForRole,
  hasMatrixPermission,
} from "@/lib/auth/permissions";
import {
  ADMIN_ROLES,
  getRoleDisplayName,
  ROLE_CATALOG,
} from "./types";
import { PERMISSION_GROUPS } from "./permission-groups";
import { CONFIGURATION_REGISTRY } from "./configuration-registry";

describe("Administration Center permissions", () => {
  it("shows admin route to administrators and hides from technicians", () => {
    assert.equal(canAccessRoute("ADMIN", "/admin"), true);
    assert.equal(canAccessRoute("SUPER_ADMIN", "/admin"), true);
    assert.equal(canAccessRoute("SERVICE_MANAGER", "/admin"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/admin"), false);
  });

  it("protects nested admin routes with specific permissions", () => {
    assert.equal(canAccessRoute("ADMIN", "/admin/users"), true);
    assert.equal(canAccessRoute("DIRECTOR", "/admin/users"), false);
    assert.equal(canAccessRoute("DIRECTOR", "/admin/audit"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/admin/roles"), false);
    assert.equal(canAccessRoute("ADMIN", "/admin/data"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/admin/deleted-records"), false);
    assert.equal(canAccessRoute("ADMIN", "/admin/approvals"), true);
    assert.equal(canAccessRoute("SERVICE_MANAGER", "/admin/approvals"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/admin/approvals"), true);
    assert.equal(canAccessRoute("TRAINER", "/admin/approvals"), false);
  });

  it("grants final-admin related capabilities only to admin roles", () => {
    assert.equal(hasMatrixPermission("ADMIN", "MANAGE_ROLES"), true);
    assert.equal(hasMatrixPermission("ADMIN", "DEACTIVATE_USERS"), true);
    assert.equal(hasMatrixPermission("SERVICE_MANAGER", "MANAGE_ROLES"), false);
    assert.equal(hasMatrixPermission("DIRECTOR", "MANAGE_USERS"), false);
  });
});

describe("Role catalog", () => {
  it("includes built-in roles with readable names", () => {
    assert.ok(ROLE_CATALOG.some((r) => r.role === "FIELD_TECHNICIAN"));
    assert.equal(getRoleDisplayName("FIELD_TECHNICIAN"), "Technician");
    assert.equal(getRoleDisplayName("SUPER_ADMIN"), "Super Administrator");
    assert.deepEqual(ADMIN_ROLES, ["ADMIN", "SUPER_ADMIN"]);
  });

  it("maps permission groups to existing MatrixPermission codes", () => {
    for (const group of PERMISSION_GROUPS) {
      for (const permission of group.permissions) {
        assert.ok(
          getDefaultPermissionsForRole("SUPER_ADMIN").includes(permission.code),
          `missing permission ${permission.code}`,
        );
      }
    }
  });
});

describe("Configuration registry", () => {
  it("defines organization-scoped protected configuration types", () => {
    assert.ok(CONFIGURATION_REGISTRY.length > 0);
    assert.ok(
      CONFIGURATION_REGISTRY.every((d) => d.scope === "ORGANIZATION"),
    );
    const priorities = CONFIGURATION_REGISTRY.find(
      (d) => d.configurationType === "service_call_priority",
    );
    assert.ok(priorities?.protectedValues?.includes("NORMAL"));
  });
});
