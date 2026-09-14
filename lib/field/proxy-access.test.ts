import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { evaluateFieldAccess, isFieldPage } from "./access";

type Request = { nextUrl: { pathname: string } };
type Auth = { protect: () => Promise<void> };
type Handler = (auth: Auth, request: Request) => Promise<Response | undefined>;

function harness(role: string | undefined, lookupFails = false) {
  const calls: string[] = [];
  const moduleRecord = { exports: {} as { default: Handler } };
  const compiled = ts.transpileModule(fs.readFileSync("proxy.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    module: moduleRecord, exports: moduleRecord.exports,
    require(name: string) {
      if (name === "next/server") return { NextResponse: Response };
      if (name === "./lib/field/access") return { evaluateFieldAccess, isFieldPage };
      if (name === "@clerk/nextjs/server") return {
        clerkMiddleware: (handler: Handler) => handler,
        createRouteMatcher: (patterns: string[]) => (request: Request) =>
          patterns.some(pattern => new RegExp("^" + pattern + "$").test(request.nextUrl.pathname)),
        currentUser: async () => {
          calls.push("user");
          if (lookupFails) throw new Error("unavailable");
          return { id: "user-a", publicMetadata: { matrixRole: role } };
        },
      };
      throw new Error("Unexpected import: " + name);
    },
  });
  return {
    calls,
    run: (pathname: string, signedIn = true) => moduleRecord.exports.default({
      protect: async () => { calls.push("protect"); if (!signedIn) throw new Error("sign-in-required"); },
    }, { nextUrl: { pathname } }),
  };
}
test("proxy verifies authentication before looking up the Field role", async () => {
  const h = harness("FIELD_TECHNICIAN");
  assert.equal(await h.run("/field/work/wo-1"), undefined);
  assert.deepEqual(h.calls, ["protect", "user"]);
});
test("proxy denies customer and missing roles with a non-cached 403", async () => {
  for (const role of ["CUSTOMER_USER", undefined]) {
    const response = await harness(role).run("/field/offline");
    assert.equal(response?.status, 403);
    assert.equal(response?.headers.get("Cache-Control"), "private, no-store");
    assert.match(await response!.text(), /Return to Service Hub/);
  }
});
test("proxy fails closed on identity outage and preserves sign-in redirect behavior", async () => {
  assert.equal((await harness("ADMIN", true).run("/field"))?.status, 503);
  const h = harness("ADMIN");
  await assert.rejects(h.run("/field", false), /sign-in-required/);
  assert.deepEqual(h.calls, ["protect"]);
});
test("proxy preserves other routes and does not fetch Field roles for them", async () => {
  const h = harness(undefined);
  assert.equal(await h.run("/dashboard"), undefined);
  assert.deepEqual(h.calls, ["protect"]);
  const publicRequest = harness(undefined);
  assert.equal(await publicRequest.run("/sign-in"), undefined);
  assert.deepEqual(publicRequest.calls, []);
});
