export function buildProtectedAttachmentStorageRef(input: { operationId: string; fileName: string }) {
  const operationId = input.operationId.trim();
  const fileName = input.fileName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!operationId || !fileName) throw new Error("Operation ID and file name are required.");
  return `field-receipts/${encodeURIComponent(operationId)}/${encodeURIComponent(fileName)}`;
}
