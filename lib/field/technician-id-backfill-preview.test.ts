import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTechnicianIdMapping, previewTechnicianIdBackfill } from "./technician-id-backfill-preview";

describe("technician ID backfill preview", () => {
  it("creates a no-write preview from explicit name mappings", () => {
    const preview = previewTechnicianIdBackfill({ totalWorkOrders: 1, primaryIdAssigned: 0, secondaryIdAssigned: 0, unassignedWorkOrders: [], nameFallbackWorkOrders: [{ id: "work_1", workOrderNumber: "WO-1", technicianName: "Alex" }] }, { alex: "user_alex" });
    assert.deepEqual(preview.ready, [{ workOrderId: "work_1", workOrderNumber: "WO-1", technicianName: "Alex", technicianId: "user_alex" }]);
    assert.deepEqual(preview.unresolved, []);
  });
  it("validates mapping input", () => {
    assert.deepEqual(parseTechnicianIdMapping('{"Alex":"user_alex"}'), { alex: "user_alex" });
    assert.throws(() => parseTechnicianIdMapping('[]'));
  });
});
