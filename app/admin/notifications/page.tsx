"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

const CHANNELS = [
  {
    name: "In-App",
    status: "Available",
    detail:
      "Session-based in-app notifications are available in the user notification center.",
  },
  {
    name: "Email",
    status: "Not Supported",
    detail:
      "No email delivery provider is configured. Matrix does not send email notifications yet.",
  },
  {
    name: "Push",
    status: "Not Supported",
    detail: "Push notification delivery is not implemented in Matrix.",
  },
  {
    name: "SMS",
    status: "Not Supported",
    detail: "SMS delivery is not implemented in Matrix.",
  },
] as const;

const SETTINGS_CHECKLIST = [
  {
    key: "service-call-assigned",
    label: "Service call assigned",
    enabled: true,
    note: "In-app only when the notification store records an event.",
  },
  {
    key: "parts-low-stock",
    label: "Low-stock parts",
    enabled: false,
    note: "Not wired to a delivery channel beyond prototype UI.",
  },
  {
    key: "pm-due",
    label: "PM due reminders",
    enabled: false,
    note: "Requires scheduled jobs and email/push — not available.",
  },
  {
    key: "security-alerts",
    label: "Security / access alerts",
    enabled: true,
    note: "Visible in admin audit/security surfaces; not emailed.",
  },
] as const;

export default function AdminNotificationsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "MANAGE_NOTIFICATION_SETTINGS");

  return (
    <AdminShell
      title="Notification Administration"
      subtitle="Channel capability and settings for Matrix notifications. Delivery is limited by current architecture."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to manage notification settings.
        </p>
      ) : (
        <div className="space-y-6">
          <MatrixCard title="Channels">
            <ul className="space-y-3">
              {CHANNELS.map((c) => (
                <li
                  key={c.name}
                  className="rounded-lg border border-slate-800 px-3 py-3"
                >
                  <p className="font-medium text-slate-100">
                    {c.name}: {c.status}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{c.detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-300">
              Open the{" "}
              <Link
                href="/notifications"
                className="text-cyan-400 underline-offset-2 hover:underline"
              >
                in-app notification center
              </Link>{" "}
              to review session notifications.
            </p>
          </MatrixCard>

          <MatrixCard title="Delivery log">
            <p className="text-sm text-slate-500">
              No notification delivery log is available. Email, push, and SMS
              delivery are not supported, so outbound delivery events are not
              recorded.
            </p>
          </MatrixCard>

          <MatrixCard title="Settings checklist (read-only)">
            <p className="mb-3 text-sm text-amber-100">
              These toggles document intended preferences only. Matrix does not
              persist organization-wide notification channel settings yet — the
              current architecture uses session in-app notifications without a
              multi-channel delivery pipeline.
            </p>
            <ul className="space-y-3">
              {SETTINGS_CHECKLIST.map((s) => (
                <li
                  key={s.key}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-800 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-100">{s.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{s.note}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      disabled
                      readOnly
                      className="rounded border-slate-600"
                    />
                    {s.enabled ? "On (documented)" : "Off (documented)"}
                  </label>
                </li>
              ))}
            </ul>
          </MatrixCard>
        </div>
      )}
    </AdminShell>
  );
}
