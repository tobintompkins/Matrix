import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFieldAccess, isFieldPage } from "./access";

test("signed-out users are denied even with an administrator role", () => {
  for (const id of [null, undefined, "", " "]) {
    assert.deepEqual(evaluateFieldAccess(id, { matrixRole: "SUPER_ADMIN" }), {allowed:false,reason:"SIGNED_OUT"});
  }
});
test("missing and malformed metadata never gains the SUPER_ADMIN fallback", () => {
  for (const metadata of [null, undefined, {}, {matrixRole:null}, {matrixRole:7}, {matrixRole:"unknown"}, {matrixRole:"__proto__"}, {matrixRole:"constructor"}, {matrixRole:"toString"}]) {
    assert.deepEqual(evaluateFieldAccess("user-a", metadata), {allowed:false,reason:"ROLE_NOT_CONFIGURED"});
  }
});
test("explicit technician and admin roles retain permitted Field entry", () => {
  for (const role of ["FIELD_TECHNICIAN", "ADMIN", "SUPER_ADMIN"]) {
    assert.deepEqual(evaluateFieldAccess("user-a", {matrixRole:role}), {allowed:true,role});
  }
});
test("customer roles do not acquire internal Field access", () => {
  for (const role of ["CUSTOMER_ADMIN","CUSTOMER_MANAGER","CUSTOMER_USER","CUSTOMER_VIEWER"]) {
    assert.deepEqual(evaluateFieldAccess("user-a", {matrixRole:role}), {allowed:false,reason:"FORBIDDEN"});
  }
});
test("the check uses current supplied metadata, not a remembered earlier decision", () => {
  assert.equal(evaluateFieldAccess("user-a", {matrixRole:"FIELD_TECHNICIAN"}).allowed,true);
  assert.equal(evaluateFieldAccess("user-a", {matrixRole:"CUSTOMER_USER"}).allowed,false);
});
test("Field path boundary covers nested pages and excludes similar unrelated paths", () => {
  for (const path of ["/field","/field/","/field/work","/field/work/wo-1/attachments","/field/offline"]) assert.equal(isFieldPage(path),true,path);
  for (const path of ["/fieldwork","/fields","/dashboard","/api/field","/portal"]) assert.equal(isFieldPage(path),false,path);
});
