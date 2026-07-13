import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canConfigureEscalation,
  canConfigureSla,
  canConfigureTicketCategories,
  canCreateCustomerPortalTicket,
  canDispatchTickets,
  canViewCustomerPortalTickets,
  canViewDispatchBoard,
} from "./dispatch-permissions";
import { canAccessRoute, hasMatrixPermission } from "./permissions";

describe("dispatch permissions (Patch 41)", () => {
  it("allows managers and admins to dispatch and configure", () => {
    assert.equal(canViewDispatchBoard("SERVICE_MANAGER"), true);
    assert.equal(canDispatchTickets("SERVICE_MANAGER"), true);
    assert.equal(canConfigureSla("SERVICE_MANAGER"), true);
    assert.equal(canConfigureEscalation("SERVICE_MANAGER"), true);
    assert.equal(canConfigureTicketCategories("ADMIN"), true);
  });

  it("allows technicians to view service calls but not configure SLA", () => {
    assert.equal(canConfigureSla("FIELD_TECHNICIAN"), false);
    assert.equal(hasMatrixPermission("FIELD_TECHNICIAN", "ACCEPT_SERVICE_CALL"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/service-calls"), true);
  });

  it("allows customer viewers portal ticket access", () => {
    assert.equal(canViewCustomerPortalTickets("CUSTOMER_VIEWER"), true);
    // Patch 42: CUSTOMER_VIEWER is read-only — cannot create tickets
    assert.equal(canCreateCustomerPortalTicket("CUSTOMER_VIEWER"), false);
    assert.equal(canAccessRoute("SERVICE_MANAGER", "/dispatch"), true);
    assert.equal(canAccessRoute("CUSTOMER_VIEWER", "/dispatch"), false);
    assert.equal(canAccessRoute("CUSTOMER_VIEWER", "/portal"), true);
  });
});
