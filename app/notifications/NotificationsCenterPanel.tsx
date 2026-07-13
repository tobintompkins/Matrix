"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatusBadge,
} from "../components/ui";
import {
  defaultNotificationFilters,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationFilterState,
} from "@/lib/notifications";

export default function NotificationsCenterPanel() {
  const [filters, setFilters] = useState<NotificationFilterState>(
    defaultNotificationFilters(),
  );
  const [tick, setTick] = useState(0);

  const notifications = useMemo(() => {
    void tick;
    return listNotifications(filters);
  }, [filters, tick]);

  const customers = useMemo(() => {
    void tick;
    return Array.from(
      new Set(
        listNotifications()
          .map((n) => n.customerName)
          .filter((c): c is string => Boolean(c)),
      ),
    ).sort();
  }, [tick]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <MatrixButton
          variant="secondary"
          size="sm"
          onClick={() => {
            markAllNotificationsRead();
            setTick((t) => t + 1);
          }}
        >
          Mark all as read
        </MatrixButton>
        <MatrixButton href="/notifications/preferences" variant="secondary" size="sm">
          Preferences
        </MatrixButton>
        <MatrixButton href="/maintenance" variant="primary" size="sm">
          Open Maintenance
        </MatrixButton>
      </div>

      <MatrixCard title="Filters" subtitle="Unread, priority, type, customer, date">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(e) =>
                setFilters((f) => ({ ...f, unreadOnly: e.target.checked }))
              }
            />
            Unread only
          </label>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.priority}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                priority: e.target.value as NotificationFilterState["priority"],
              }))
            }
          >
            <option value="ALL">Priority</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.maintenanceType}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                maintenanceType: e.target
                  .value as NotificationFilterState["maintenanceType"],
              }))
            }
          >
            <option value="ALL">Maintenance Type</option>
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
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.customer}
            onChange={(e) =>
              setFilters((f) => ({ ...f, customer: e.target.value }))
            }
          >
            <option value="">Customer</option>
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.dateFrom}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateFrom: e.target.value }))
            }
          />
          <input
            type="date"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.dateTo}
            onChange={(e) =>
              setFilters((f) => ({ ...f, dateTo: e.target.value }))
            }
          />
        </div>
      </MatrixCard>

      <MatrixCard title="All Notifications" subtitle={`${notifications.length} matching`}>
        {notifications.length === 0 ? (
          <MatrixEmptyState
            title="No notifications"
            description="Reminders generate automatically from fleet maintenance status."
          />
        ) : (
          <ul className="divide-y divide-slate-800">
            {notifications.map((n) => (
              <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{n.title}</p>
                    {!n.readAt && (
                      <MatrixStatusBadge variant="warning" label="Unread" />
                    )}
                    <MatrixStatusBadge
                      variant={
                        n.priority === "URGENT" || n.priority === "HIGH"
                          ? "error"
                          : "active"
                      }
                      label={n.priority}
                    />
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {n.type} · {n.customerName ?? "—"} ·{" "}
                    {n.createdAt.slice(0, 19).replace("T", " ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!n.readAt && (
                    <MatrixButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        markNotificationRead(n.id);
                        setTick((t) => t + 1);
                      }}
                    >
                      Mark as read
                    </MatrixButton>
                  )}
                  {n.printerId && (
                    <Link
                      href={`/digital-twin/${n.printerId}`}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-slate-800"
                    >
                      Open printer
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </MatrixCard>
    </div>
  );
}
