export function validateCompletionReceipt(payload: Record<string, unknown>) {
  const resolution = typeof payload.resolution === "string" ? payload.resolution.trim() : "";
  if (!resolution) return { ok: false as const, error: "Completion requires a resolution note." };
  if (payload.signatureDeclined !== true && payload.signatureCaptured !== true) {
    return { ok: false as const, error: "Completion requires a signature or recorded decline." };
  }
  return { ok: true as const, resolution };
}
