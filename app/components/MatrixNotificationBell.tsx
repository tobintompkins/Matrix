"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import {
  defaultNotificationFilters,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type MatrixNotification,
  type NotificationFilterState,
} from "@/lib/notifications";

function priorityClass(priority: MatrixNotification["priority"]): string {
  switch (priority) {
    case "URGENT":
      return "text-rose-400";
    case "HIGH":
      return "text-orange-300";
    case "NORMAL":
      return "text-cyan-300";
    default:
      return "text-slate-400";
  }
}

export default function MatrixNotificationBell() {
  const canView = hasMatrixPermission(DEV_FALLBACK_ROLE, "VIEW_NOTIFICATIONS");
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [filters, setFilters] = useState<NotificationFilterState>(
    defaultNotificationFilters(),
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const notifications = useMemo(() => {
    void tick;
    if (!canView) return [];
    return listNotifications(filters);
  }, [canView, filters, tick]);

  const unread = useMemo(() => {
    void tick;
    if (!canView) return 0;
    return getUnreadNotificationCount();
  }, [canView, tick]);

  if (!canView) return null;

  const recent = notifications.slice(0, 8);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => !v);
          setTick((t) => t + 1);
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-50 mt-2 w-[22rem] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl sm:w-[26rem]"
          role="dialog"
          aria-label="Notification center"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <p className="font-semibold text-white">Notifications</p>
              <p className="text-xs text-slate-500">{unread} unread</p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              onClick={() => {
                markAllNotificationsRead();
                setTick((t) => t + 1);
              }}
            >
              Mark all as read
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-slate-800 p-3 text-xs">
            <label className="inline-flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={filters.unreadOnly}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, unreadOnly: e.target.checked }))
                }
              />
              Unread
            </label>
            <select
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={filters.priority}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  priority: e.target.value as NotificationFilterState["priority"],
                }))
              }
            >
              <option value="ALL">All priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
            <select
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={filters.maintenanceType}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  maintenanceType: e.target
                    .value as NotificationFilterState["maintenanceType"],
                }))
              }
            >
              <option value="ALL">All types</option>
              <option value="PM_DUE_SOON">PM Due Soon</option>
              <option value="PM_DUE">PM Due</option>
              <option value="PM_OVERDUE">PM Overdue</option>
              <option value="CLEANING_DUE">Cleaning Due</option>
              <option value="JOINT_UNIT_DUE">Joint Unit Due</option>
              <option value="DTF_PM_DUE">DTF PM Due</option>
              <option value="MAINTENANCE_COMPLETED">Completed</option>
              <option value="COPY_COUNT_UPDATED">Copy Count</option>
              <option value="SCHEDULE_CHANGED">Schedule Changed</option>
            </select>
            <input
              type="date"
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
              aria-label="From date"
            />
          </div>

          <ul className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500">
                No notifications match these filters.
              </li>
            ) : (
              recent.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-slate-800/80 px-4 py-3 ${
                    n.readAt ? "opacity-70" : "bg-slate-950/40"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      markNotificationRead(n.id);
                      setTick((t) => t + 1);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {n.title}
                      </p>
                      <span
                        className={`shrink-0 text-[10px] font-bold uppercase ${priorityClass(n.priority)}`}
                      >
                        {n.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{n.message}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {n.customerName ?? "—"} · {n.createdAt.slice(0, 16).replace("T", " ")}
                      {!n.readAt ? " · Unread" : ""}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-xs">
            <Link
              href="/notifications"
              className="font-semibold text-cyan-300 hover:text-cyan-200"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
            <Link
              href="/notifications/preferences"
              className="text-slate-400 hover:text-slate-200"
              onClick={() => setOpen(false)}
            >
              Preferences
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
