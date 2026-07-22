"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MatrixButton, MatrixCard } from "../../components/ui";
import PortalShell from "../PortalShell";
import { getNotificationPrefs, saveNotificationPrefs } from "@/lib/portal";

type NotifItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  href?: string;
};

export default function PortalNotificationsPage() {
  const initial = getNotificationPrefs();
  const [prefs, setPrefs] = useState(initial);
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/portal/notifications", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to load");
      setItems(json.items ?? []);
      setUnreadCount(json.unreadCount ?? 0);
      if (json.preferences) setPrefs(json.preferences);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function markRead(id: string) {
    await fetch("/api/portal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", id }),
    });
    await load();
  }

  async function markAll() {
    await fetch("/api/portal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markAllRead" }),
    });
    await load();
  }

  if (!prefs) {
    return (
      <PortalShell title="Notifications">
        <p className="text-rose-300">Sign in with an active membership.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell title="Notifications">
      {error ? <p className="mb-3 text-sm text-rose-200">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}

      <MatrixCard title={`Inbox (${unreadCount} unread)`} className="mb-6">
        <div className="mb-3 flex flex-wrap gap-2">
          <MatrixButton type="button" variant="secondary" size="md" onClick={() => void markAll()}>
            Mark all read
          </MatrixButton>
          <MatrixButton type="button" variant="secondary" size="md" onClick={() => void load()}>
            Refresh
          </MatrixButton>
        </div>
        <ul className="divide-y divide-slate-800 text-sm">
          {items.length === 0 ? (
            <li className="py-3 text-slate-400">No notifications yet.</li>
          ) : (
            items.map((n) => (
              <li
                key={n.id}
                className={`py-3 ${n.read ? "opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {n.href ? (
                      <Link href={n.href} className="font-medium text-cyan-300">
                        {n.title}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-200">{n.title}</p>
                    )}
                    <p className="text-slate-400">{n.message}</p>
                    <p className="text-xs text-slate-500">
                      {n.type} · {new Date(n.createdAt).toLocaleString()}
                      {n.read ? " · Read" : " · Unread"}
                    </p>
                  </div>
                  {!n.read && !n.id.startsWith("ann-") ? (
                    <MatrixButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void markRead(n.id)}
                    >
                      Mark read
                    </MatrixButton>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </MatrixCard>

      <MatrixCard title="Delivery preferences">
        <div className="grid gap-3 text-sm">
          {(
            [
              ["ticketUpdates", "Ticket updates"],
              ["appointments", "Appointments"],
              ["pmUpdates", "PM updates"],
              ["reports", "Reports"],
              ["announcements", "Announcements"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3">
              <span className="text-slate-300">{label}</span>
              <select
                value={prefs[key]}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    [key]: e.target.value as typeof prefs.ticketUpdates,
                  })
                }
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
              >
                <option value="IMMEDIATE">Immediate</option>
                <option value="DAILY">Daily summary</option>
                <option value="OFF">Off</option>
              </select>
            </label>
          ))}
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={prefs.inAppEnabled}
              onChange={(e) => setPrefs({ ...prefs, inAppEnabled: e.target.checked })}
            />
            In-app notifications
          </label>
          <MatrixButton
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              const r = saveNotificationPrefs(prefs);
              setNotice(r.ok ? "Preferences saved" : r.error ?? "Failed");
            }}
          >
            Save preferences
          </MatrixButton>
        </div>
      </MatrixCard>
    </PortalShell>
  );
}
