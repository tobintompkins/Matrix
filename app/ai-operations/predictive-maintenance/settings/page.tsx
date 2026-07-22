"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import PredictiveNav from "../PredictiveNav";

export default function PredictiveSettingsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canManage = hasMatrixPermission(role, "MANAGE_PREDICTIVE_SETTINGS");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(
      "/api/ai-operations/predictive-maintenance/settings",
      { cache: "no-store" },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Failed");
      return;
    }
    setSettings(json.settings);
    setProfile(json.profile);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings || !canManage) return;
    setMessage("");
    const res = await fetch(
      "/api/ai-operations/predictive-maintenance/settings",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: Boolean(settings.enabled),
          scheduledEvaluationEnabled: Boolean(settings.scheduledEvaluationEnabled),
          healthScoreWarningThreshold: Number(settings.healthScoreWarningThreshold),
          healthScoreCriticalThreshold: Number(settings.healthScoreCriticalThreshold),
          pmDueSoonDays: Number(settings.pmDueSoonDays),
          staleMeterDays: Number(settings.staleMeterDays),
          repeatFailureLookbackDays: Number(settings.repeatFailureLookbackDays),
          repeatFailureThreshold: Number(settings.repeatFailureThreshold),
          usageSpikePercent: Number(settings.usageSpikePercent),
          minimumDataQualityScore: Number(settings.minimumDataQualityScore),
          minimumConfidenceForAlert: Number(settings.minimumConfidenceForAlert),
          autoCreateRecommendations: Boolean(settings.autoCreateRecommendations),
          autoCreateInternalAlerts: Boolean(settings.autoCreateInternalAlerts),
          requireApprovalForServiceCallCreation: Boolean(
            settings.requireApprovalForServiceCallCreation,
          ),
        }),
      },
    );
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setSettings(json.settings);
    setMessage("Settings saved. Historical snapshots keep their original scoring version.");
  }

  function setField(key: string, value: unknown) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <MatrixShell title="Predictive Settings" activePath="/ai-operations/predictive-maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_PREDICTIVE_MAINTENANCE"]}>
        <PredictiveNav />
        <MatrixCard
          title="Predictive maintenance settings"
          subtitle="Changing weights/thresholds versions future runs only"
        >
          {error ? <p className="mb-2 text-sm text-rose-300">{error}</p> : null}
          {message ? <p className="mb-2 text-sm text-cyan-300">{message}</p> : null}
          {!settings ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["enabled", "Enabled", "checkbox"],
                  ["scheduledEvaluationEnabled", "Scheduled evaluation", "checkbox"],
                  ["autoCreateRecommendations", "Auto-create recommendations", "checkbox"],
                  ["autoCreateInternalAlerts", "Auto-create alerts", "checkbox"],
                  [
                    "requireApprovalForServiceCallCreation",
                    "Require approval for SC creation",
                    "checkbox",
                  ],
                  ["healthScoreWarningThreshold", "Warning threshold", "number"],
                  ["healthScoreCriticalThreshold", "Critical threshold", "number"],
                  ["pmDueSoonDays", "PM due-soon days", "number"],
                  ["staleMeterDays", "Stale meter days", "number"],
                  ["repeatFailureLookbackDays", "Repeat lookback days", "number"],
                  ["repeatFailureThreshold", "Repeat failure count", "number"],
                  ["usageSpikePercent", "Usage spike %", "number"],
                  ["minimumDataQualityScore", "Min data quality", "number"],
                  ["minimumConfidenceForAlert", "Min confidence for alerts", "number"],
                ] as const
              ).map(([key, label, type]) => (
                <label key={key} className="block text-sm text-slate-300">
                  {label}
                  {type === "checkbox" ? (
                    <input
                      type="checkbox"
                      className="ml-2"
                      checked={Boolean(settings[key])}
                      disabled={!canManage}
                      onChange={(e) => setField(key, e.target.checked)}
                    />
                  ) : (
                    <input
                      type="number"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                      value={Number(settings[key] ?? 0)}
                      disabled={!canManage}
                      onChange={(e) => setField(key, Number(e.target.value))}
                    />
                  )}
                </label>
              ))}
            </div>
          )}
          {canManage ? (
            <div className="mt-4">
              <MatrixButton type="button" variant="primary" size="md" onClick={() => void save()}>
                Save settings
              </MatrixButton>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">Read-only for your role.</p>
          )}
          {profile ? (
            <p className="mt-4 text-xs text-slate-500">
              Scoring profile: {String(profile.name)} · v{String(profile.version)} ·{" "}
              {String(settings?.scoringVersion ?? "")}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            Cron: POST /api/internal/predictive-maintenance/evaluate with
            PREDICTIVE_MAINTENANCE_CRON_SECRET.
          </p>
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
