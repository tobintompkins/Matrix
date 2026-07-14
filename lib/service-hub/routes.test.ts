import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessRoute } from "@/lib/auth/permissions";

describe("Service Hub routes", () => {
  it("allows VIEW_DASHBOARD roles to open /dashboard and /service-hub", () => {
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/dashboard"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/service-hub"), true);
    assert.equal(canAccessRoute("SERVICE_MANAGER", "/service-hub"), true);
  });

  it("keeps customer portal dashboard separate from Matrix Service Hub", () => {
    assert.equal(canAccessRoute("CUSTOMER_ADMIN", "/portal/dashboard"), true);
    assert.equal(canAccessRoute("CUSTOMER_ADMIN", "/dashboard"), true);
  });
});
