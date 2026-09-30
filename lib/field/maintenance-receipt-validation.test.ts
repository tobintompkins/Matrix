import assert from "node:assert/strict";
import test from "node:test";
import { validateFieldMaintenanceReceipt } from "./maintenance-receipt-validation";
test("maintenance receipt accepts a completed PM", () => assert.equal(validateFieldMaintenanceReceipt({ kind: "PM", copyCount: 100, checklistComplete: true }).ok, true));
test("maintenance receipt rejects incomplete or invalid maintenance", () => { assert.equal(validateFieldMaintenanceReceipt({ kind: "PM", copyCount: 100 }).ok, false); assert.equal(validateFieldMaintenanceReceipt({ kind: "OTHER", copyCount: 100, checklistComplete: true }).ok, false); });
