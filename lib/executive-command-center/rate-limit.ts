/**
 * Patch 51A.5 Part 3 Completion — lightweight rate limit for expensive ECC endpoints.
 */

const buckets = new Map<string, number[]>();

export function checkExecutiveRateLimit(
  key: string,
  limitPerMinute = 20,
): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const windowMs = 60_000;
  const stamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= limitPerMinute) {
    const oldest = stamps[0] ?? now;
    return {
      ok: false,
      retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000),
    };
  }
  stamps.push(now);
  buckets.set(key, stamps);
  return { ok: true };
}

export function _resetExecutiveRateLimits() {
  buckets.clear();
}
