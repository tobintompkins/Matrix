import assert from "node:assert/strict";
import test from "node:test";
import { validateFieldCopyCountReceipt } from "./copy-count-receipt-validation";

test("copy-count receipt accepts a whole non-negative meter", () => {
  assert.deepEqual(validateFieldCopyCountReceipt({ copyCount: "125000", note: "End of service" }), {
    ok: true, copyCount: 125000, lowerCountReason: "", note: "End of service",
  });
});

test("copy-count receipt rejects invalid meter values", () => {
  assert.equal(validateFieldCopyCountReceipt({ copyCount: -1 }).ok, false);
  assert.equal(validateFieldCopyCountReceipt({ copyCount: 12.5 }).ok, false);
});
