import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTechnicianAssignedToWorkOrder,
  parseOptionalTechnicianId,
} from "./field-technician-assignment";

const order = {
  assignedTechnician: "Alex Rivera",
  secondaryTechnician: "Sam Ortiz",
  assignedTechnicianId: "user_primary",
  secondaryTechnicianId: "user_secondary",
};

describe("field technician assignment", () => {
  it("matches durable technician IDs before names are required", () => {
    assert.equal(
      isTechnicianAssignedToWorkOrder({ userId: "user_primary" }, order),
      true,
    );
    assert.equal(
      isTechnicianAssignedToWorkOrder({ userId: "user_other" }, order),
      false,
    );
  });

  it("falls back to legacy name matching when IDs are absent", () => {
    const nameOnly = {
      assignedTechnician: "Toby Tompkins",
      secondaryTechnician: "",
      assignedTechnicianId: null,
      secondaryTechnicianId: null,
    };
    assert.equal(
      isTechnicianAssignedToWorkOrder(
        { userId: "user_toby", technicianName: "Toby Tompkins" },
        nameOnly,
      ),
      true,
    );
  });

  it("falls back to names when stored IDs do not match during migration", () => {
    const migrating = {
      assignedTechnician: "Toby Tompkins",
      secondaryTechnician: "",
      assignedTechnicianId: "user_stale",
      secondaryTechnicianId: null,
    };
    assert.equal(
      isTechnicianAssignedToWorkOrder(
        { userId: "user_toby", technicianName: "Toby Tompkins" },
        migrating,
      ),
      true,
    );
  });

  it("parses optional technician id fields for office assignment updates", () => {
    assert.equal(parseOptionalTechnicianId(undefined), undefined);
    assert.equal(parseOptionalTechnicianId(null), null);
    assert.equal(parseOptionalTechnicianId(""), null);
    assert.equal(parseOptionalTechnicianId(" user_abc "), "user_abc");
  });
});
