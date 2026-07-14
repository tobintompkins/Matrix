import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isManagerOrAdminRole,
  isTechnicianRole,
  serviceHubWelcomeMessage,
} from "./welcome";

describe("serviceHubWelcomeMessage", () => {
  it("returns technician-focused copy for field technicians", () => {
    assert.match(
      serviceHubWelcomeMessage("FIELD_TECHNICIAN"),
      /assigned service calls/i,
    );
  });

  it("returns management copy for service managers", () => {
    assert.match(
      serviceHubWelcomeMessage("SERVICE_MANAGER"),
      /technician workload/i,
    );
  });

  it("returns organization-wide copy for administrators", () => {
    assert.match(
      serviceHubWelcomeMessage("SUPER_ADMIN"),
      /organization-wide/i,
    );
  });

  it("falls back when role is unavailable", () => {
    assert.match(serviceHubWelcomeMessage(null), /latest activity/i);
    assert.match(serviceHubWelcomeMessage(undefined), /latest activity/i);
  });

  it("classifies technician and manager roles", () => {
    assert.equal(isTechnicianRole("FIELD_TECHNICIAN"), true);
    assert.equal(isTechnicianRole("ADMIN"), false);
    assert.equal(isManagerOrAdminRole("SERVICE_MANAGER"), true);
    assert.equal(isManagerOrAdminRole("FIELD_TECHNICIAN"), false);
  });
});
