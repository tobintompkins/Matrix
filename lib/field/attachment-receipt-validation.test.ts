import assert from "node:assert/strict";
import test from "node:test";
import { validateAttachmentReceipt } from "./attachment-receipt-validation";

test("attachment receipt accepts a valid PDF", () => {
  assert.equal(validateAttachmentReceipt({ fileName: "service-report.pdf", mimeType: "application/pdf", sizeBytes: 1024 }).ok, true);
});
test("attachment receipt rejects unsupported files and oversized uploads", () => {
  assert.equal(validateAttachmentReceipt({ fileName: "file.exe", mimeType: "application/octet-stream", sizeBytes: 100 }).ok, false);
  assert.equal(validateAttachmentReceipt({ fileName: "large.pdf", mimeType: "application/pdf", sizeBytes: 11 * 1024 * 1024 }).ok, false);
});
