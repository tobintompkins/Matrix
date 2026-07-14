"use client";

import { useEffect, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "../../components/ui";

type SettingsPayload = {
  enabled: boolean;
  allowHistorySummaries: boolean;
  allowPartsSuggestions: boolean;
  allowServiceNoteDrafts: boolean;
  allowTroubleshootingTemplates: boolean;
  requireFeedbackOnComplete: boolean;
  maxResponseLength: number;
  conversationRetentionDays: number;
  approvedModel: string | null;
  disclaimerOverride: string | null;
};

export default function MatrixAssistAdminPage() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [env, setEnv] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<Array<{ eventType: string; _count: { _all: number } }>>(
    [],
  );
  const [templates, setTemplates] = useState<
    Array<{ id: string; title: string; symptomCategory: string; active: boolean }>
  >([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const res = await fetch("/api/matrix-assist/settings", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Unable to load settings.");
      return;
    }
    setSettings(data.settings);
    setEnv(data.env);
    setUsage(data.usage ?? []);
    setTemplates(data.templates ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    setNotice("");
    const res = await fetch("/api/matrix-assist/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Unable to save settings.");
      return;
    }
    setSettings(data.settings);
    setNotice("Settings saved. API keys are never returned by this endpoint.");
  }

  return (
    <AdminShell
      title="Matrix Assist settings"
      subtitle="Organization controls for advisory AI diagnostics."
    >
      <MatrixAuthGuard requiredPermissions={["MANAGE_MATRIX_ASSIST_SETTINGS"]}>
        {error ? (
          <p className="mb-4 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-4 text-sm text-emerald-300" role="status">
            {notice}
          </p>
        ) : null}

        {settings ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <MatrixCard title="Feature controls">
              <div className="space-y-3 text-sm text-slate-200">
                {(
                  [
                    ["enabled", "Enable Matrix Assist"],
                    ["allowHistorySummaries", "Allow service-history summaries"],
                    ["allowPartsSuggestions", "Allow parts suggestions"],
                    ["allowServiceNoteDrafts", "Allow service-note drafts"],
                    [
                      "allowTroubleshootingTemplates",
                      "Allow troubleshooting templates",
                    ],
                    [
                      "requireFeedbackOnComplete",
                      "Require feedback after completed session",
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(settings[key])}
                      onChange={(e) =>
                        setSettings({ ...settings, [key]: e.target.checked })
                      }
                    />
                    {label}
                  </label>
                ))}
                <label className="block">
                  Max response length
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                    value={settings.maxResponseLength}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxResponseLength: Number(e.target.value) || 4000,
                      })
                    }
                  />
                </label>
                <label className="block">
                  Conversation retention (days)
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                    value={settings.conversationRetentionDays}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        conversationRetentionDays: Number(e.target.value) || 90,
                      })
                    }
                  />
                </label>
                <label className="block">
                  Approved model label
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                    value={settings.approvedModel ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        approvedModel: e.target.value || null,
                      })
                    }
                    placeholder="Display only — secrets stay in env"
                  />
                </label>
                <label className="block">
                  Disclaimer override
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                    value={settings.disclaimerOverride ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        disclaimerOverride: e.target.value || null,
                      })
                    }
                  />
                </label>
                <MatrixButton type="button" variant="primary" onClick={() => void save()}>
                  Save settings
                </MatrixButton>
              </div>
            </MatrixCard>

            <div className="space-y-6">
              <MatrixCard title="Environment">
                <pre className="overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                  {JSON.stringify(env, null, 2)}
                </pre>
                <p className="mt-2 text-xs text-slate-500">
                  Configure AI_PROVIDER, AI_API_KEY, AI_MODEL, and
                  AI_ASSIST_ENABLED in server environment variables. Keys are
                  never shown here.
                </p>
              </MatrixCard>

              <MatrixCard title="Usage summary">
                {usage.length === 0 ? (
                  <p className="text-sm text-slate-500">No usage events yet.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-slate-300">
                    {usage.map((u) => (
                      <li key={u.eventType}>
                        {u.eventType}: {u._count._all}
                      </li>
                    ))}
                  </ul>
                )}
              </MatrixCard>

              <MatrixCard title="Troubleshooting templates">
                <ul className="space-y-2 text-sm text-slate-300">
                  {templates.map((t) => (
                    <li key={t.id}>
                      {t.title}{" "}
                      <span className="text-slate-500">
                        ({t.symptomCategory}
                        {t.active ? "" : ", inactive"})
                      </span>
                    </li>
                  ))}
                </ul>
              </MatrixCard>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Loading…</p>
        )}
      </MatrixAuthGuard>
    </AdminShell>
  );
}
