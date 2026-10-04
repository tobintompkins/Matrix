import assert from "node:assert/strict";
import test from "node:test";
import { validateFieldWorkSessionReceipt } from "./work-session-receipt-validation";
test("accepts a Field work-session action", () => assert.equal(validateFieldWorkSessionReceipt({ action: "START_WORK" }).ok, true));
test("rejects an unknown work-session action", () => assert.equal(validateFieldWorkSessionReceipt({ action: "DELETE" }).ok, false));
