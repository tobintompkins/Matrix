import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendWorkOrderNoteText } from "./office-server-mutations";
import { quickActionTarget } from "./workflow";

describe("office server UI mutations", () => {
  it("appends note text without dropping existing content", () => {
    assert.equal(appendWorkOrderNoteText("Line one", "Line two"), "Line one\nLine two");
    assert.equal(appendWorkOrderNoteText("", "First"), "First");
  });

  it("maps quick actions to workflow targets for server status patches", () => {
    assert.equal(quickActionTarget("start", "SCHEDULED"), "TRAVELING");
    assert.equal(quickActionTarget("complete", "ON_SITE"), "COMPLETED");
    assert.equal(quickActionTarget("complete", "NEW"), null);
  });
});
