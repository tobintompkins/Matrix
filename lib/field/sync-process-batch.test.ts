import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toFieldSyncProcessBatchLimit } from "./sync-process-batch";

describe("Field sync processing batch", () => {
  it("keeps supported batch limits", () => {
    assert.equal(toFieldSyncProcessBatchLimit("5"), 5);
    assert.equal(toFieldSyncProcessBatchLimit(50), 50);
  });

  it("falls back to the safe default for unsupported values", () => {
    assert.equal(toFieldSyncProcessBatchLimit(1), 25);
    assert.equal(toFieldSyncProcessBatchLimit("not-a-number"), 25);
  });
});
