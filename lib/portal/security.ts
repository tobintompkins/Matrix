/**
 * Simple in-memory rate limiting for portal abuse prevention.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: true } | { ok: false; error: string; retryAfterMs: number } {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= limit) {
    return {
      ok: false,
      error: "Too many requests. Please wait and try again.",
      retryAfterMs: existing.resetAt - now,
    };
  }
  existing.count += 1;
  return { ok: true };
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}

/** Validate portal upload mime + size. */
export function validatePortalUpload(
  mimeType: string,
  sizeBytes: number,
  maxBytes = 10 * 1024 * 1024,
): { ok: true } | { ok: false; error: string } {
  const allowed = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "application/pdf",
    "video/mp4",
  ]);
  if (!allowed.has(mimeType.toLowerCase())) {
    return { ok: false, error: "File type not allowed." };
  }
  if (sizeBytes <= 0 || sizeBytes > maxBytes) {
    return { ok: false, error: "File size exceeds the allowed limit." };
  }
  return { ok: true };
}

export function safeFileName(original: string): string {
  const base = original.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  if (!base || base.includes("..") || base.startsWith("/")) {
    return `upload-${Date.now()}.bin`;
  }
  return base;
}
