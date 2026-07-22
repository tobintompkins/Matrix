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
  duplicateConfidenceThreshold: number;
  meterOutlierJumpPct: number;
  staleDays: number;
  scanBatchSize: number;
  automaticScanEnabled: boolean;
  dimensionWeights: Record<string, number>;
};

export default function DataQualitySettingsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_DATA_QUALITY_CENTER");
  const canManage = hasMatrixPermission(role, "MANAGE_DATA_QUALITY_SETTINGS");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/data-quality/settings", { cache: "no-store" });
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
      <AdminShell title="Data Quality Settings">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Data Quality Settings"
      subtitle="Score weights, thresholds, and scan defaults."
    >
      <Link href="/admin/data-quality">
        <MatrixButton variant="secondary">← Dashboard</MatrixButton>
      </Link>
      {note ? <p className="mt-3 text-sm text-amber-200/90">{note}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      {message ? <p className="mt-3 text-sm text-emerald-300">{message}</p> : null}
      {settings ? (
        <MatrixCard title="Settings" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Enabled
              <input
                type="checkbox"
                className="ml-2"
                checked={settings.enabled}
                disabled={!canManage}
                onChange={(e) =>
                  setSettings({ ...settings, enabled: e.target.checked })
                }
              />
            </label>
            <label className="text-xs text-slate-400">
              Automatic scan enabled (scheduler unavailable)
              <input
                type="checkbox"
                className="ml-2"
                checked={settings.automaticScanEnabled}
                disabled={!canManage}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    automaticScanEnabled: e.target.checked,
                  })
                }
              />
            </label>
            {(
              [
                ["duplicateConfidenceThreshold", "Duplicate confidence"],
                ["meterOutlierJumpPct", "Meter outlier jump %"],
                ["staleDays", "Stale days"],
                ["scanBatchSize", "Scan batch size"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs text-slate-400">
                {label}
                <input
                  type="number"
                  className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                  value={settings[key]}
                  disabled={!canManage}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      [key]: Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          {canManage ? (
            <div className="mt-4">
              <MatrixButton
                onClick={async () => {
                  setError("");
                  setMessage("");
                  const res = await fetch("/api/data-quality/settings", {
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
            </div>
          ) : null}
        </MatrixCard>
      ) : null}
    </AdminShell>
  );
}
