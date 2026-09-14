import test from "node:test";
import assert from "node:assert/strict";
import { resolveFieldIdentity } from "./identity";
test("missing users, names and unconfigured roles do not receive demo identity", () => {
  for (const user of [null, undefined, {id:"u1",fullName:"Alex"}, {id:"u1", publicMetadata:{matrixRole:"FIELD_TECHNICIAN"}}]) assert.equal(resolveFieldIdentity(user),null);
});
test("Clerk user ID owns new records; configured assignment name is used", () => {
  assert.deepEqual(resolveFieldIdentity({id:"clerk-user",fullName:"Alex Jones",publicMetadata:{matrixRole:"FIELD_TECHNICIAN",technicianName:"  Alex J.  ",technicianId:"legacy-id"}}), {userId:"clerk-user",technicianName:"Alex J.",role:"FIELD_TECHNICIAN"});
});
test("full name is used when no assignment-name override is set", () => {
  assert.equal(resolveFieldIdentity({id:"u1",fullName:" Alex Jones ",publicMetadata:{matrixRole:"FIELD_TECHNICIAN",technicianName:7}})?.technicianName,"Alex Jones");
});
test("switching users changes owner and name; customer role is denied", () => {
  const a=resolveFieldIdentity({id:"a",fullName:"Alex",publicMetadata:{matrixRole:"FIELD_TECHNICIAN"}});
  const b=resolveFieldIdentity({id:"b",fullName:"Sam",publicMetadata:{matrixRole:"FIELD_TECHNICIAN"}});
  assert.notDeepEqual(a,b);
  assert.equal(resolveFieldIdentity({id:"a",fullName:"Alex",publicMetadata:{matrixRole:"CUSTOMER_USER"}}),null);
});
