import assert from "node:assert/strict";
import test from "node:test";
import { validateFieldSignatureReceipt } from "./signature-receipt-validation";

test("signature receipt accepts a named customer signature", () => {
  assert.deepEqual(validateFieldSignatureReceipt({ customerName: "Jamie Customer" }), {
    ok: true,
    kind: "captured",
    signerName: "Jamie Customer",
  });
});

test("signature receipt requires a customer name or decline reason", () => {
  assert.equal(validateFieldSignatureReceipt({}).ok, false);
  assert.equal(validateFieldSignatureReceipt({ declined: true }).ok, false);
  assert.deepEqual(validateFieldSignatureReceipt({ declined: true, declineReason: "Customer unavailable" }), {
    ok: true,
    kind: "declined",
    declineReason: "Customer unavailable",
  });
});
