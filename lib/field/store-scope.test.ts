import assert from "node:assert/strict";
import test from "node:test";
import { clearOfflineStoreScope, getOfflineStore, resetOfflineStoreForTests, setOfflineStoreScope } from "./store";
test("separate signed-in Field users receive isolated stores", async () => {
  resetOfflineStoreForTests();
  setOfflineStoreScope("alex"); await getOfflineStore().put("meta", {id:"one", value:"alex"});
  setOfflineStoreScope("sam"); assert.equal(await getOfflineStore().get("meta", "one"), null);
  await getOfflineStore().put("meta", {id:"one", value:"sam"});
  setOfflineStoreScope("alex"); assert.deepEqual(await getOfflineStore().get("meta", "one"), {id:"one", value:"alex"});
});
test("legacy unscoped storage is separate and invalid scopes are rejected", async () => {
  resetOfflineStoreForTests(); clearOfflineStoreScope(); await getOfflineStore().put("meta", {id:"legacy", value:true});
  setOfflineStoreScope("alex"); assert.equal(await getOfflineStore().get("meta", "legacy"), null);
  assert.throws(() => setOfflineStoreScope("  "), /authenticated Field user ID/);
});
