/**
 * Patch 49C — Organization announcements (Service Hub audience).
 */

export type AnnouncementAudience =
  | "ALL_USERS"
  | "TECHNICIANS"
  | "MANAGERS"
  | "DIRECTORS"
  | "ADMINISTRATORS"
  | "SPECIFIC_REGION";

export type AdminAnnouncement = {
  id: string;
  title: string;
  message: string;
  audience: AnnouncementAudience;
  regionId: string | null;
  priority: "NORMAL" | "HIGH";
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  link: string | null;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "matrix.admin.announcements.v1";
let memory: AdminAnnouncement[] | null = null;

function read(): AdminAnnouncement[] {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        memory = JSON.parse(raw) as AdminAnnouncement[];
        return memory;
      }
    } catch {
      /* ignore */
    }
  }
  memory = [];
  return memory;
}

function write(next: AdminAnnouncement[]) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function sanitizeText(value: string, max = 2000): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim()
    .slice(0, max);
}

export function listAnnouncements(includeExpired = false): AdminAnnouncement[] {
  const now = new Date().toISOString();
  return read()
    .filter((a) => {
      if (!includeExpired && a.endsAt && a.endsAt < now) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listActiveAnnouncementsForHub(): AdminAnnouncement[] {
  const now = new Date().toISOString();
  return listAnnouncements(false).filter(
    (a) => a.active && a.startsAt <= now && (!a.endsAt || a.endsAt >= now),
  );
}

export function createAnnouncement(input: {
  title: string;
  message: string;
  audience: AnnouncementAudience;
  regionId?: string | null;
  priority?: "NORMAL" | "HIGH";
  startsAt?: string;
  endsAt?: string | null;
  link?: string | null;
  actorUserId: string;
  actorName: string;
}): { ok: true; announcement: AdminAnnouncement } | { ok: false; error: string } {
  const title = sanitizeText(input.title, 120);
  const message = sanitizeText(input.message, 2000);
  if (title.length < 3) return { ok: false, error: "Title is required." };
  if (message.length < 3) return { ok: false, error: "Message is required." };

  const now = new Date().toISOString();
  const announcement: AdminAnnouncement = {
    id: `ann-${Date.now()}`,
    title,
    message,
    audience: input.audience,
    regionId: input.regionId ?? null,
    priority: input.priority ?? "NORMAL",
    startsAt: input.startsAt ?? now,
    endsAt: input.endsAt ?? null,
    active: true,
    link: input.link ? sanitizeText(input.link, 500) : null,
    createdByUserId: input.actorUserId,
    createdByName: input.actorName,
    createdAt: now,
    updatedAt: now,
  };
  write([announcement, ...read()]);
  return { ok: true, announcement };
}

export function archiveAnnouncement(
  id: string,
): { ok: true } | { ok: false; error: string } {
  const rows = read();
  const idx = rows.findIndex((a) => a.id === id);
  if (idx < 0) return { ok: false, error: "Announcement not found." };
  const next = [...rows];
  next[idx] = {
    ...next[idx],
    active: false,
    endsAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  write(next);
  return { ok: true };
}
