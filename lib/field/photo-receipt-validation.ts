const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export function validatePhotoReceipt(payload: Record<string, unknown>) {
  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.trim() : "";
  const sizeBytes = Number(payload.sizeBytes);
  if (!fileName) return { ok: false as const, error: "Photo file name is required." };
  if (!mimeType.startsWith("image/")) return { ok: false as const, error: "Only image photos are allowed." };
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_PHOTO_BYTES) return { ok: false as const, error: "Photo size must be between 1 byte and 10 MB." };
  return { ok: true as const, fileName, mimeType, sizeBytes };
}
