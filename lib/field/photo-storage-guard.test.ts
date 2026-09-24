import assert from "node:assert/strict";
import test from "node:test";
import { buildProtectedPhotoStorageRef } from "./photo-storage-guard";

test("photo storage reference is isolated by operation and safe file name", () => {
  assert.equal(buildProtectedPhotoStorageRef({ operationId: "op 2", fileName: "meter photo.jpg" }), "field-photos/op%202/meter_photo.jpg");
});
test("photo storage reference rejects missing values", () => {
  assert.throws(() => buildProtectedPhotoStorageRef({ operationId: "", fileName: "photo.jpg" }));
});
