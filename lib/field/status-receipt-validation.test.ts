import assert from "node:assert/strict";
import test from "node:test";
import { validateFieldStatusReceipt } from "./status-receipt-validation";

test("Field status receipts reject unsupported statuses", () => {
  assert.equal(validateFieldStatusReceipt("ON_SITE", "CANCELLED").ok, false);
});
test("Field status receipts enforce the work-order transition rules", () => {
  assert.equal(validateFieldStatusReceipt("ON_SITE", "COMPLETED").ok, true);
});
