/**
 * Patch 51A.1 Part 3 — Per-user assistant rate limiting (in-process).
 */

import { aiConfig } from "@/config/ai";

const buckets = new Map<string, number[]>();

export function checkAssistantRateLimit(userId: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const windowMs = 60_000;
  const limit = aiConfig.assistantRateLimitPerMinute;
  const stamps = (buckets.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= limit) {
    const oldest = stamps[0] ?? now;
    return {
      ok: false,
      retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000),
    };
  }
  stamps.push(now);
  buckets.set(userId, stamps);
  return { ok: true };
}

/** Test helper */
export function _resetAssistantRateLimits() {
  buckets.clear();
}
