import assert from "node:assert/strict";
import test from "node:test";
import { clearOfflineStoreScope, getOfflineStore, resetOfflineStoreForTests, revokeOfflineStoreForUser, setOfflineStoreScope } from "./store";

test("sign-out revocation clears only the current Field user's offline data", async () => {
  resetOfflineStoreForTests();
  setOfflineStoreScope("alex");
  await getOfflineStore().put("meta", { id: "identity", value: "alex" });
  setOfflineStoreScope("sam");
  await getOfflineStore().put("meta", { id: "identity", value: "sam" });
  await revokeOfflineStoreForUser("alex");
  setOfflineStoreScope("alex");
  assert.equal(await getOfflineStore().get("meta", "identity"), null);
  setOfflineStoreScope("sam");
  assert.deepEqual(await getOfflineStore().get("meta", "identity"), { id: "identity", value: "sam" });
  clearOfflineStoreScope();
});
