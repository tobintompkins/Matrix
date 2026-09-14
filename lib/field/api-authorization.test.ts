import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessFieldWorkOrder, fieldApiActor, hasConfiguredFieldApiIdentity } from "./api-authorization";

const fieldTech = { userId: "user_1", role: "FIELD_TECH" as const, displayName: "Toby Tompkins", technicianName: "Toby Tompkins" };

describe("Field API authorization", () => {
  it("only allows a technician's primary or secondary assignment", () => {
    assert.equal(canAccessFieldWorkOrder(fieldTech, { assignedTechnician: "Toby Tompkins", secondaryTechnician: "Alex Rivera" }), true);
    assert.equal(canAccessFieldWorkOrder(fieldTech, { assignedTechnician: "Alex Rivera", secondaryTechnician: "Sam Ortiz" }), false);
  });
  it("allows dispatch roles to access every technician's work", () => {
    assert.equal(canAccessFieldWorkOrder({ ...fieldTech, role: "SERVICE_MANAGER" }, { assignedTechnician: "Alex Rivera", secondaryTechnician: "" }), true);
  });
  it("refuses the local development role fallback for API requests", () => {
    assert.equal(hasConfiguredFieldApiIdentity(fieldTech), true);
    assert.equal(hasConfiguredFieldApiIdentity({ ...fieldTech, usingDevFallbackRole: true }), false);
    assert.equal(fieldApiActor({ ...fieldTech, technicianName: "  Toby  " }), "Toby");
  });
});
