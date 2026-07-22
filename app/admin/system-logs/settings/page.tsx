"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

type Settings = {
  enabled: boolean;
  apiRequestLoggingEnabled: boolean;
  failedAuthLoggingEnabled: boolean;
  dataChangeLoggingEnabled: boolean;
  debugLoggingEnabled: boolean;
  requestPayloadLoggingEnabled: boolean;
  responsePayloadLoggingEnabled: boolean;
};

export default function SystemLogSettingsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_SYSTEM_LOGS");
  const canManage = hasMatrixPermission(role, "MANAGE_LOG_SETTINGS");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/system-logs/settings", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Unable to load settings.");
      return;
    }
    setSettings(json.settings);
    setNote(json.note ?? "");
  }, []);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, load]);

  if (!canView) {
    return (
      <AdminShell title="System Log Settings">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="System Log Settings" subtitle="Production-safe logging defaults.">
      <Link href="/admin/system-logs">
        <MatrixButton variant="secondary">← Dashboard</MatrixButton>
      </Link>
      {note ? <p className="mt-3 text-sm text-amber-200/90">{note}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {settings ? (
        <MatrixCard title="Settings" className="mt-4">
          {(
            [
              ["enabled", "System Logs enabled"],
              ["apiRequestLoggingEnabled", "API request logging"],
              ["failedAuthLoggingEnabled", "Failed authentication logging"],
              ["dataChangeLoggingEnabled", "Data change logging"],
              ["debugLoggingEnabled", "Debug logging"],
              ["requestPayloadLoggingEnabled", "Request payload logging (disabled in production)"],
              ["responsePayloadLoggingEnabled", "Response payload logging (disabled)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mb-2 block text-sm text-slate-300">
              <input
                type="checkbox"
                className="mr-2"
                checked={Boolean(settings[key])}
                disabled={!canManage || key.includes("Payload")}
                onChange={(e) =>
                  setSettings({ ...settings, [key]: e.target.checked })
                }
              />
              {label}
            </label>
          ))}
          {canManage ? (
            <MatrixButton
              className="mt-3"
              onClick={async () => {
                setError("");
                setMessage("");
                const res = await fetch("/api/system-logs/settings", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(settings),
                });
                const json = await res.json();
                if (!res.ok || !json.ok) {
                  setError(json.error ?? "Save failed.");
                } else {
                  setMessage("Settings saved.");
                  setSettings(json.settings);
                }
              }}
            >
              Save Settings
            </MatrixButton>
          ) : null}
        </MatrixCard>
      ) : null}
    </AdminShell>
  );
}
