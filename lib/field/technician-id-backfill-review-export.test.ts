import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTechnicianIdBackfillReviewCsv } from "./technician-id-coverage";

describe("technician ID backfill review export", () => {
  it("exports only assignments requiring review with CSV escaping", () => {
    const csv = buildTechnicianIdBackfillReviewCsv({
      totalWorkOrders: 2,
      primaryIdAssigned: 1,
      secondaryIdAssigned: 0,
      nameFallbackWorkOrders: [{ id: "work_1", workOrderNumber: "WO-1", technicianName: "Alex \"A\"" }],
      unassignedWorkOrders: [{ id: "work_2", workOrderNumber: "WO-2" }],
    });
    assert.match(csv, /NAME_FALLBACK/);
    assert.match(csv, /Alex ""A""/);
    assert.match(csv, /UNASSIGNED/);
    assert.doesNotMatch(csv, /primaryIdAssigned/);
  });
});
