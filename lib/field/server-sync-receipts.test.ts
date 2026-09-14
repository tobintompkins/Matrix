import assert from "node:assert/strict";
import test from "node:test";
import { buildFieldSyncReceipt } from "./sync-receipt";

test("server receipt derives actor and owner from the signed-in profile", () => {
  const receipt = buildFieldSyncReceipt(
    { userId: "clerk_1", role: "FIELD_TECH", technicianName: "Alex Rivera" },
    "clerk_1",
    { operationId: "op-1", type: "NOTE", workOrderId: "wo-1", printerId: null, payload: { note: "Done" }, dependsOn: [] },
  );
  assert.equal(receipt.userId, "clerk_1");
  assert.equal(receipt.technicianName, "Alex Rivera");
  assert.equal(receipt.payload, '{"note":"Done"}');
});
