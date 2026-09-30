export type ValidFieldSignatureReceipt =
  | { ok: true; kind: "captured"; signerName: string }
  | { ok: true; kind: "declined"; declineReason: string }
  | { ok: false; error: string };

/** Validate only the durable signature evidence Matrix currently receives. */
export function validateFieldSignatureReceipt(payload: Record<string, unknown>): ValidFieldSignatureReceipt {
  if (payload.declined === true) {
    const declineReason = typeof payload.declineReason === "string" ? payload.declineReason.trim() : "";
    return declineReason
      ? { ok: true, kind: "declined", declineReason }
      : { ok: false, error: "A signature-decline reason is required." };
  }

  const signerName = typeof payload.customerName === "string" ? payload.customerName.trim() : "";
  return signerName
    ? { ok: true, kind: "captured", signerName }
    : { ok: false, error: "Customer name is required for a signature." };
}
