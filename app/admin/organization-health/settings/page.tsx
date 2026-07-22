"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { HealthSettings } from "@/lib/organization-health/score";

export default function OrganizationHealthSettingsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canManage = hasMatrixPermission(role, "MANAGE_HEALTH_SCORE_WEIGHTS");
  const canView = hasMatrixPermission(role, "VIEW_ORGANIZATION_HEALTH");
  const [settings, setSettings] = useState<HealthSettings | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await fetch("/api/organization-health/settings");
        const json = await res.json();
        if (json.ok) setSettings(json.settings);
      })();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView]);

  async function save() {
    if (!settings || !canManage) return;
    const res = await fetch("/api/organization-health/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    setNotice(json.ok ? "Settings saved." : json.error ?? "Save failed");
    if (json.settings) setSettings(json.settings);
  }

  if (!canView) {
    return (
      <AdminShell title="Organization Health Settings">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Organization Health Settings"
      subtitle="Weights, thresholds, and feature toggles"
    >
      <Link href="/admin/organization-health" className="mb-4 inline-block text-sm text-cyan-300">
        ← Organization Health
      </Link>
      {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}
      {!settings ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <MatrixCard title="Score configuration">
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={!canManage}
              onChange={(e) =>
                setSettings({ ...settings, enabled: e.target.checked })
              }
            />
            Organization Health enabled
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(settings.weights) as Array<keyof typeof settings.weights>).map(
              (key) => (
                <label key={key} className="text-sm text-slate-300">
                  {key} weight %
                  <input
                    type="number"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                    value={settings.weights[key]}
                    disabled={!canManage}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        weights: {
                          ...settings.weights,
                          [key]: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <span className="ml-2 text-xs">
                    <input
                      type="checkbox"
                      checked={settings.enabledCategories[key]}
                      disabled={!canManage}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          enabledCategories: {
                            ...settings.enabledCategories,
                            [key]: e.target.checked,
                          },
                        })
                      }
                    />{" "}
                    enabled
                  </span>
                </label>
              ),
            )}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-300">
              Excellent min
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                value={settings.thresholds.excellentMin}
                disabled={!canManage}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    thresholds: {
                      ...settings.thresholds,
                      excellentMin: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </label>
            <label className="text-sm text-slate-300">
              PM compliance watch below
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                value={settings.pmComplianceWatchBelow}
                disabled={!canManage}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    pmComplianceWatchBelow: Number(e.target.value) || 0,
                  })
                }
              />
            </label>
          </div>
          {canManage ? (
            <div className="mt-4">
              <MatrixButton type="button" variant="primary" onClick={() => void save()}>
                Save settings
              </MatrixButton>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              Read-only — requires MANAGE_HEALTH_SCORE_WEIGHTS.
            </p>
          )}
        </MatrixCard>
      )}
    </AdminShell>
  );
}
