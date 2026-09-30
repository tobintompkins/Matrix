import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTechnicianIdCoverage } from "./technician-id-coverage";

describe("technician ID coverage", () => {
  it("separates durable assignments from legacy name fallback", () => {
    const coverage = buildTechnicianIdCoverage([
      { id: "1", workOrderNumber: "WO-1", assignedTechnician: "Alex", assignedTechnicianId: "user_alex", secondaryTechnician: null, secondaryTechnicianId: null },
      { id: "2", workOrderNumber: "WO-2", assignedTechnician: "Sam", assignedTechnicianId: null, secondaryTechnician: "Alex", secondaryTechnicianId: "user_alex" },
      { id: "3", workOrderNumber: "WO-3", assignedTechnician: null, assignedTechnicianId: null, secondaryTechnician: null, secondaryTechnicianId: null },
    ]);
    assert.equal(coverage.totalWorkOrders, 3);
    assert.equal(coverage.primaryIdAssigned, 1);
    assert.equal(coverage.secondaryIdAssigned, 1);
    assert.deepEqual(coverage.nameFallbackWorkOrders, [{ id: "2", workOrderNumber: "WO-2", technicianName: "Sam" }]);
    assert.deepEqual(coverage.unassignedWorkOrders, [{ id: "3", workOrderNumber: "WO-3" }]);
  });
});
