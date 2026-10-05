import assert from "node:assert/strict";
import test from "node:test";
import { validateFieldTimeEntryReceipt } from "./time-entry-receipt-validation";
test("accepts valid Field time entry", () => assert.deepEqual(validateFieldTimeEntryReceipt({ hours: 1.25 }), { ok: true, hours: 1.25, note: "" }));
test("rejects invalid Field time entry", () => assert.equal(validateFieldTimeEntryReceipt({ hours: 0 }).ok, false));
