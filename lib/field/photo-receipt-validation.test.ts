import assert from "node:assert/strict";
import test from "node:test";
import { validatePhotoReceipt } from "./photo-receipt-validation";

test("photo receipt accepts a valid image under the size limit", () => {
  assert.equal(validatePhotoReceipt({ fileName: "before.jpg", mimeType: "image/jpeg", sizeBytes: 1024 }).ok, true);
});
test("photo receipt rejects non-image files and oversized files", () => {
  assert.equal(validatePhotoReceipt({ fileName: "file.pdf", mimeType: "application/pdf", sizeBytes: 100 }).ok, false);
  assert.equal(validatePhotoReceipt({ fileName: "large.jpg", mimeType: "image/jpeg", sizeBytes: 11 * 1024 * 1024 }).ok, false);
});
