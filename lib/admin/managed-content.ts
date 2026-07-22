/**
 * Patch 50C-3 — Managed content (sanitized, no source/HTML/DB editor).
 */

export type ManagedContentVisibility = "INTERNAL_ONLY" | "CUSTOMER_VISIBLE";
export type ManagedContentKind =
  | "DASHBOARD_ANNOUNCEMENT"
  | "PORTAL_ANNOUNCEMENT"
  | "HELP_TEXT"
  | "SERVICE_INSTRUCTION"
  | "PM_INSTRUCTION"
  | "SYSTEM_NOTICE"
  | "CONFIGURABLE_LABEL"
  | "KNOWLEDGE_CONTENT";

export type ManagedContentStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "UNPUBLISHED"
  | "ARCHIVED";

export type ManagedContentRecord = {
  id: string;
  kind: ManagedContentKind;
  title: string;
  body: string;
  visibility: ManagedContentVisibility;
  status: ManagedContentStatus;
  organizationId: string;
  createdByUserId: string;
  createdByName: string;
  updatedByUserId: string;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
};

const STORAGE_KEY = "matrix.admin.managed-content.v1";
let memory: ManagedContentRecord[] | null = null;

function read(): ManagedContentRecord[] {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as ManagedContentRecord[];
        return memory;
      }
    } catch {
      /* ignore */
    }
  }
  memory = [];
  return memory;
}

function write(next: ManagedContentRecord[]) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function sanitizeManagedContent(value: string, max = 8000): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim()
    .slice(0, max);
}

export function listManagedContent(input?: {
  status?: ManagedContentStatus | "ALL";
  kind?: ManagedContentKind | "ALL";
  search?: string;
}): ManagedContentRecord[] {
  let rows = [...read()];
  if (input?.status && input.status !== "ALL") {
    rows = rows.filter((r) => r.status === input.status);
  }
  if (input?.kind && input.kind !== "ALL") {
    rows = rows.filter((r) => r.kind === input.kind);
  }
  const q = input?.search?.trim().toLowerCase() ?? "";
  if (q) {
    rows = rows.filter((r) =>
      [r.title, r.body, r.kind, r.visibility].join(" ").toLowerCase().includes(q),
    );
  }
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createManagedContent(input: {
  kind: ManagedContentKind;
  title: string;
  body: string;
  visibility: ManagedContentVisibility;
  organizationId: string;
  actorUserId: string;
  actorName: string;
}): { ok: true; record: ManagedContentRecord } | { ok: false; error: string } {
  const title = sanitizeManagedContent(input.title, 200);
  const body = sanitizeManagedContent(input.body);
  if (title.length < 3) return { ok: false, error: "Title is required." };
  if (body.length < 3) return { ok: false, error: "Body is required." };
  const now = new Date().toISOString();
  const record: ManagedContentRecord = {
    id: `mc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    title,
    body,
    visibility: input.visibility,
    status: "DRAFT",
    organizationId: input.organizationId,
    createdByUserId: input.actorUserId,
    createdByName: input.actorName,
    updatedByUserId: input.actorUserId,
    updatedByName: input.actorName,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    archivedAt: null,
    archiveReason: null,
  };
  write([record, ...read()]);
  return { ok: true, record };
}

export function updateManagedContent(
  id: string,
  patch: Partial<Pick<ManagedContentRecord, "title" | "body" | "visibility" | "kind">>,
  actor: { userId: string; displayName: string },
): { ok: true; record: ManagedContentRecord } | { ok: false; error: string } {
  const rows = read();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Content not found." };
  const current = rows[idx]!;
  if (current.status === "ARCHIVED") {
    return { ok: false, error: "Restore archived content before editing." };
  }
  const next: ManagedContentRecord = {
    ...current,
    title: patch.title != null ? sanitizeManagedContent(patch.title, 200) : current.title,
    body: patch.body != null ? sanitizeManagedContent(patch.body) : current.body,
    visibility: patch.visibility ?? current.visibility,
    kind: patch.kind ?? current.kind,
    updatedAt: new Date().toISOString(),
    updatedByUserId: actor.userId,
    updatedByName: actor.displayName,
  };
  const copy = [...rows];
  copy[idx] = next;
  write(copy);
  return { ok: true, record: next };
}

export function publishManagedContent(
  id: string,
  actor: { userId: string; displayName: string },
): { ok: true; record: ManagedContentRecord } | { ok: false; error: string } {
  const rows = read();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Content not found." };
  const current = rows[idx]!;
  if (current.status === "ARCHIVED") {
    return { ok: false, error: "Cannot publish archived content." };
  }
  const now = new Date().toISOString();
  const next: ManagedContentRecord = {
    ...current,
    status: "PUBLISHED",
    publishedAt: now,
    updatedAt: now,
    updatedByUserId: actor.userId,
    updatedByName: actor.displayName,
  };
  const copy = [...rows];
  copy[idx] = next;
  write(copy);
  return { ok: true, record: next };
}

export function unpublishManagedContent(
  id: string,
  actor: { userId: string; displayName: string },
): { ok: true; record: ManagedContentRecord } | { ok: false; error: string } {
  const rows = read();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Content not found." };
  const current = rows[idx]!;
  const next: ManagedContentRecord = {
    ...current,
    status: "UNPUBLISHED",
    updatedAt: new Date().toISOString(),
    updatedByUserId: actor.userId,
    updatedByName: actor.displayName,
  };
  const copy = [...rows];
  copy[idx] = next;
  write(copy);
  return { ok: true, record: next };
}

export function archiveManagedContent(
  id: string,
  reason: string,
  actor: { userId: string; displayName: string },
): { ok: true; record: ManagedContentRecord } | { ok: false; error: string } {
  if (reason.trim().length < 3) return { ok: false, error: "Archive reason required." };
  const rows = read();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Content not found." };
  const current = rows[idx]!;
  const now = new Date().toISOString();
  const next: ManagedContentRecord = {
    ...current,
    status: "ARCHIVED",
    archivedAt: now,
    archiveReason: sanitizeManagedContent(reason, 500),
    updatedAt: now,
    updatedByUserId: actor.userId,
    updatedByName: actor.displayName,
  };
  const copy = [...rows];
  copy[idx] = next;
  write(copy);
  return { ok: true, record: next };
}

export function restoreManagedContent(
  id: string,
  actor: { userId: string; displayName: string },
): { ok: true; record: ManagedContentRecord } | { ok: false; error: string } {
  const rows = read();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Content not found." };
  const current = rows[idx]!;
  if (current.status !== "ARCHIVED") {
    return { ok: false, error: "Content is not archived." };
  }
  const next: ManagedContentRecord = {
    ...current,
    status: "DRAFT",
    archivedAt: null,
    archiveReason: null,
    updatedAt: new Date().toISOString(),
    updatedByUserId: actor.userId,
    updatedByName: actor.displayName,
  };
  const copy = [...rows];
  copy[idx] = next;
  write(copy);
  return { ok: true, record: next };
}

export function deleteDraftManagedContent(
  id: string,
): { ok: true } | { ok: false; error: string } {
  const rows = read();
  const current = rows.find((r) => r.id === id);
  if (!current) return { ok: false, error: "Content not found." };
  if (current.status !== "DRAFT") {
    return { ok: false, error: "Only draft content can be deleted. Archive published content instead." };
  }
  write(rows.filter((r) => r.id !== id));
  return { ok: true };
}

export function __resetManagedContentForTests(): void {
  memory = [];
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
