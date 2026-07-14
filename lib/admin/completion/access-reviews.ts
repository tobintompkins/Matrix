/**
 * Patch 49C — Access review workflow (does not auto-remove access).
 */

export type AccessReviewStatus =
  | "Not Reviewed"
  | "Approved"
  | "Change Required"
  | "Access Removed";

export type AccessReviewItem = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  role: string;
  scope: string;
  elevated: boolean;
  lastActiveAt: string | null;
  status: AccessReviewStatus;
  reviewerName: string | null;
  reviewedAt: string | null;
  notes: string | null;
};

const STORAGE_KEY = "matrix.admin.access-reviews.v1";
let memory: AccessReviewItem[] | null = null;

function read(): AccessReviewItem[] {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as AccessReviewItem[];
        return memory;
      }
    } catch {
      /* ignore */
    }
  }
  memory = [];
  return memory;
}

function write(next: AccessReviewItem[]) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function listAccessReviews(): AccessReviewItem[] {
  return [...read()].sort((a, b) => a.userName.localeCompare(b.userName));
}

export function upsertAccessReviewSeed(
  users: Array<{
    id: string;
    name: string;
    email: string;
    matrixRole: string;
    accessScope?: string;
    lastActiveAt?: string | null;
  }>,
): AccessReviewItem[] {
  const existing = read();
  const byUser = new Map(existing.map((e) => [e.userId, e]));
  const next: AccessReviewItem[] = users.map((u) => {
    const prev = byUser.get(u.id);
    if (prev) return prev;
    return {
      id: `ar-${u.id}`,
      userId: u.id,
      userName: u.name,
      email: u.email,
      role: u.matrixRole,
      scope: u.accessScope ?? "ORGANIZATION",
      elevated: ["ADMIN", "SUPER_ADMIN"].includes(u.matrixRole),
      lastActiveAt: u.lastActiveAt ?? null,
      status: "Not Reviewed",
      reviewerName: null,
      reviewedAt: null,
      notes: null,
    };
  });
  write(next);
  return next;
}

export function completeAccessReview(input: {
  reviewId: string;
  status: AccessReviewStatus;
  notes: string;
  reviewerName: string;
}): { ok: true; item: AccessReviewItem } | { ok: false; error: string } {
  if (input.status === "Access Removed") {
    return {
      ok: false,
      error:
        "Access is not removed automatically. Mark Change Required and deactivate the user from Users & Access with confirmation.",
    };
  }
  if (input.notes.trim().length < 3) {
    return { ok: false, error: "Review notes are required." };
  }
  const rows = read();
  const idx = rows.findIndex((r) => r.id === input.reviewId);
  if (idx < 0) return { ok: false, error: "Access review not found." };
  const item: AccessReviewItem = {
    ...rows[idx],
    status: input.status,
    notes: input.notes.trim(),
    reviewerName: input.reviewerName,
    reviewedAt: new Date().toISOString(),
  };
  const next = [...rows];
  next[idx] = item;
  write(next);
  return { ok: true, item };
}
