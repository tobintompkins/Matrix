/**
 * In-memory sliding-window rate limiter for Matrix Assist.
 * Does not block normal service-call workflows — only AI endpoints.
 */

type Bucket = { timestamps: number[] };

const userBuckets = new Map<string, Bucket>();
const orgBuckets = new Map<string, Bucket>();

const USER_LIMIT = 30; // per 10 minutes
const ORG_LIMIT = 200; // per 10 minutes
const WINDOW_MS = 10 * 60 * 1000;

function prune(bucket: Bucket, now: number): void {
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < WINDOW_MS);
}

export function checkMatrixAssistRateLimit(input: {
  userId: string;
  organizationId?: string | null;
}): { ok: true } | { ok: false; message: string } {
  const now = Date.now();
  const userKey = input.userId || "anonymous";
  const userBucket = userBuckets.get(userKey) ?? { timestamps: [] };
  prune(userBucket, now);
  if (userBucket.timestamps.length >= USER_LIMIT) {
    return {
      ok: false,
      message:
        "Matrix Assist has reached the current usage limit. Try again later or continue using the standard service workflow.",
    };
  }

  const orgKey = input.organizationId?.trim() || "default-org";
  const orgBucket = orgBuckets.get(orgKey) ?? { timestamps: [] };
  prune(orgBucket, now);
  if (orgBucket.timestamps.length >= ORG_LIMIT) {
    return {
      ok: false,
      message:
        "Matrix Assist has reached the current usage limit. Try again later or continue using the standard service workflow.",
    };
  }

  userBucket.timestamps.push(now);
  orgBucket.timestamps.push(now);
  userBuckets.set(userKey, userBucket);
  orgBuckets.set(orgKey, orgBucket);
  return { ok: true };
}

/** Test helper */
export function resetMatrixAssistRateLimits(): void {
  userBuckets.clear();
  orgBuckets.clear();
}
