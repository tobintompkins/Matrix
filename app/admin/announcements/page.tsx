"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import {
  archiveAnnouncement,
  createAnnouncement,
  listAnnouncements,
  type AdminAnnouncement,
  type AnnouncementAudience,
} from "@/lib/admin/completion/announcements";

const AUDIENCES: AnnouncementAudience[] = [
  "ALL_USERS",
  "TECHNICIANS",
  "MANAGERS",
  "DIRECTORS",
  "ADMINISTRATORS",
  "SPECIFIC_REGION",
];

export default function AdminAnnouncementsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canManage = hasMatrixPermission(role, "MANAGE_ANNOUNCEMENTS");
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("ALL_USERS");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH">("NORMAL");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function refresh() {
    setItems(listAnnouncements(true));
  }

  useEffect(() => {
    if (!canManage) return;
    refresh();
  }, [canManage]);

  function onCreate() {
    setError("");
    setNotice("");
    const result = createAnnouncement({
      title,
      message,
      audience,
      priority,
      actorUserId: user?.id ?? "unknown",
      actorName:
        user?.fullName ||
        user?.primaryEmailAddress?.emailAddress ||
        "Administrator",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    setMessage("");
    setPriority("NORMAL");
    setAudience("ALL_USERS");
    setNotice("Announcement created.");
    refresh();
  }

  function onArchive(id: string) {
    setError("");
    setNotice("");
    const result = archiveAnnouncement(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice("Announcement archived.");
    refresh();
  }

  return (
    <AdminShell
      title="Announcements"
      subtitle="Organization announcements for Service Hub audiences."
    >
      {!canManage ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to manage announcements.
        </p>
      ) : (
        <>
          {error ? (
            <p className="mb-3 text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mb-3 text-sm text-emerald-300" role="status">
              {notice}
            </p>
          ) : null}

          <MatrixCard title="Create announcement" className="mb-6">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="ann-title">
                  Title
                </label>
                <input
                  id="ann-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500" htmlFor="ann-message">
                  Message
                </label>
                <textarea
                  id="ann-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor="ann-audience">
                    Audience
                  </label>
                  <select
                    id="ann-audience"
                    value={audience}
                    onChange={(e) =>
                      setAudience(e.target.value as AnnouncementAudience)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  >
                    {AUDIENCES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500" htmlFor="ann-priority">
                    Priority
                  </label>
                  <select
                    id="ann-priority"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as "NORMAL" | "HIGH")
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>
              </div>
              <MatrixButton type="button" onClick={onCreate}>
                Publish announcement
              </MatrixButton>
            </div>
          </MatrixCard>

          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No announcements yet.</p>
            ) : (
              items.map((a) => (
                <MatrixCard
                  key={a.id}
                  title={a.title}
                  subtitle={`${a.audience} · ${a.priority} · ${a.active ? "Active" : "Archived"}`}
                  actions={
                    a.active ? (
                      <MatrixButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onArchive(a.id)}
                      >
                        Archive
                      </MatrixButton>
                    ) : undefined
                  }
                >
                  <p className="whitespace-pre-wrap text-sm text-slate-300">
                    {a.message}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    By {a.createdByName} · {a.createdAt.slice(0, 19).replace("T", " ")}
                  </p>
                </MatrixCard>
              ))
            )}
          </div>
        </>
      )}
    </AdminShell>
  );
}
