import assert from "node:assert/strict";
import test from "node:test";
import { buildProtectedAttachmentStorageRef } from "./attachment-storage-guard";

test("attachment storage reference contains a safe operation folder and file name", () => {
  assert.equal(buildProtectedAttachmentStorageRef({ operationId: "op 1", fileName: "before repair.jpg" }), "field-receipts/op%201/before_repair.jpg");
});

test("attachment storage reference rejects missing required values", () => {
  assert.throws(() => buildProtectedAttachmentStorageRef({ operationId: "", fileName: "photo.jpg" }));
});
