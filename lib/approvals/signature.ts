/**
 * Patch 50A — Digital decision verification (HMAC).
 * Not a handwritten signature — verification hash for immutable decisions.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret =
    process.env.APPROVAL_SIGNATURE_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.DATABASE_URL;
  if (!secret) {
    return "matrix-dev-approval-signature-secret";
  }
  return secret;
}

export type SignaturePayload = {
  approvalRequestId: string;
  approvalStepId: string | null;
  decision: string;
  decidedByUserId: string;
  decidedByRoleName: string | null;
  decidedAtIso: string;
  organizationId: string;
};

export function generateDecisionSignature(payload: SignaturePayload): string {
  const material = [
    payload.approvalRequestId,
    payload.approvalStepId ?? "",
    payload.decision,
    payload.decidedByUserId,
    payload.decidedByRoleName ?? "",
    payload.decidedAtIso,
    payload.organizationId,
  ].join("|");

  return createHmac("sha256", getSecret()).update(material, "utf8").digest("hex");
}

export function verifyDecisionSignature(
  payload: SignaturePayload,
  signatureHash: string,
): boolean {
  const expected = generateDecisionSignature(payload);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signatureHash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
