import test from "node:test";
import assert from "node:assert/strict";
import { applyWorkSessionAction, getSessionForWorkOrder } from "./sessions";
import { useMemoryOfflineStoreForTests, resetOfflineStoreForTests } from "./store";
test("two technicians on one work order keep distinct sessions and actors", async () => {
  useMemoryOfflineStoreForTests();
  try {
    const a=await applyWorkSessionAction({workOrderId:"shared-job",technicianId:"a",technicianName:"Alex",action:"START_WORK"});
    const b=await applyWorkSessionAction({workOrderId:"shared-job",technicianId:"b",technicianName:"Sam",action:"START_WORK"});
    assert.equal(a.ok,true); assert.equal(b.ok,true);
    assert.notEqual(a.session?.id,b.session?.id);
    assert.equal((await getSessionForWorkOrder("shared-job","a"))?.technicianName,"Alex");
    assert.equal((await getSessionForWorkOrder("shared-job","b"))?.technicianName,"Sam");
    assert.equal(await getSessionForWorkOrder("shared-job","unknown"),null);
  } finally { resetOfflineStoreForTests(); }
});
