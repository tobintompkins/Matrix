import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFieldSyncReceiptReviewCsv,
  filterFieldSyncReceipts,
  listFieldSyncReceiptTypes,
} from "./sync-receipt-queue";

const receipts = [
  { operationId: "op_1", type: "NOTE", status: "RECEIVED", technicianName: "Alex", workOrderId: "WO-1", printerId: "P-1", createdAt: "2026-09-30", updatedAt: "2026-09-30", lastError: null },
  { operationId: "op_2", type: "PART", status: "REJECTED", technicianName: "Sam", workOrderId: "WO-2", printerId: "P-2", createdAt: "2026-09-30", updatedAt: "2026-09-30", lastError: "Part quantity is required." },
  { operationId: "op_3", type: "PHOTO", status: "APPLIED", technicianName: "Alex", workOrderId: "WO-3", printerId: "P-3", createdAt: "2026-09-30", updatedAt: "2026-09-30", lastError: null },
];

describe("Field sync receipt queue", () => {
  it("filters receipts by status and type", () => {
    const filtered = filterFieldSyncReceipts(receipts, {
      status: "REJECTED",
      type: "PART",
      query: "",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.operationId, "op_2");
  });

  it("searches receipt identifiers, technician names, and errors", () => {
    const filtered = filterFieldSyncReceipts(receipts, {
      status: "ALL",
      type: "ALL",
      query: "quantity",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.type, "PART");
  });

  it("lists types once in stable order", () => {
    assert.deepEqual(listFieldSyncReceiptTypes(receipts), ["NOTE", "PART", "PHOTO"]);
  });

  it("exports visible receipts with CSV escaping for review handoff", () => {
    const csv = buildFieldSyncReceiptReviewCsv([{ ...receipts[1]!, technicianName: 'Sam, "Parts"' }]);
    assert.match(csv, /Receipt ID,Type,Status/);
    assert.match(csv, /"Sam, ""Parts"""/);
    assert.match(csv, /Part quantity is required\./);
  });
});
