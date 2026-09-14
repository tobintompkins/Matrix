import assert from "node:assert/strict";
import test from "node:test";
import { clearOfflineStoreScope, getOfflineStore, resetOfflineStoreForTests, retireLegacyOfflineStore, setOfflineStoreScope } from "./store";

test("retiring the legacy store does not clear a signed-in user's store", async () => {
  resetOfflineStoreForTests();
  clearOfflineStoreScope();
  await getOfflineStore().put("meta", { id: "legacy", value: true });
  setOfflineStoreScope("alex");
  await getOfflineStore().put("meta", { id: "identity", value: "alex" });
  await retireLegacyOfflineStore();
  assert.deepEqual(await getOfflineStore().get("meta", "identity"), { id: "identity", value: "alex" });
  clearOfflineStoreScope();
  assert.equal(await getOfflineStore().get("meta", "legacy"), null);
});
