/**
 * Patch 51A.2 — Idempotency helpers.
 */

import { createHash } from "node:crypto";

export function buildIdempotencyKey(input: {
  automationId: string;
  triggerSource: string;
  triggerReferenceId?: string | null;
  dryRun?: boolean;
  windowBucket?: string;
}): string {
  const raw = [
    input.automationId,
    input.triggerSource,
    input.triggerReferenceId ?? "",
    input.dryRun ? "dry" : "live",
    input.windowBucket ?? "",
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 48);
}

/** Hour bucket for scheduled runs to prevent duplicate same-hour executions. */
export function hourBucket(d = new Date()): string {
  return d.toISOString().slice(0, 13);
}
