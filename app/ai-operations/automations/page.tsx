"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import { MatrixButton, MatrixCard, MatrixStatCard } from "../../components/ui";

type Tab =
  | "overview"
  | "library"
  | "builder"
  | "history"
  | "approvals"
  | "templates"
  | "settings";

const NAV = [
  { href: "/ai-operations", label: "Overview" },
  { href: "/ai-operations/assistant", label: "Assistant" },
  { href: "/ai-operations/automations", label: "Automations" },
];

export default function AutomationsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_AI_AUTOMATIONS");
  const canCreate = hasMatrixPermission(role, "CREATE_AI_AUTOMATIONS");
  const canEdit = hasMatrixPermission(role, "EDIT_AI_AUTOMATIONS");
  const canRun = hasMatrixPermission(role, "RUN_AI_AUTOMATIONS");
  const canApprove = hasMatrixPermission(role, "APPROVE_AI_AUTOMATIONS");
  const canSettings = hasMatrixPermission(role, "MANAGE_AI_AUTOMATION_SETTINGS");

  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [executions, setExecutions] = useState<Array<Record<string, unknown>>>([]);
  const [approvals, setApprovals] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [triggers, setTriggers] = useState<Array<Record<string, unknown>>>([]);
  const [actions, setActions] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    triggerType: "EVENT",
    eventType: "service_call.created",
    scheduleExpression: "daily",
    riskLevel: "LOW",
    approvalMode: "BEFORE_HIGH_IMPACT_ACTION",
    actionKey: "notification.dashboard_alert",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [o, list, hist, appr, tmpl, set] = await Promise.all([
        fetch("/api/ai-operations/automations?overview=1").then((r) => r.json()),
        fetch("/api/ai-operations/automations").then((r) => r.json()),
        fetch("/api/ai-operations/automations/executions").then((r) => r.json()),
        canApprove
          ? fetch("/api/ai-operations/automations/approvals").then((r) => r.json())
          : Promise.resolve({ ok: true, items: [] }),
        fetch("/api/ai-operations/automations/templates").then((r) => r.json()),
        fetch("/api/ai-operations/automations/settings").then((r) => r.json()),
      ]);
      if (o.ok) setOverview(o.overview);
      if (list.ok) setItems(list.items ?? []);
      if (hist.ok) setExecutions(hist.items ?? []);
      if (appr.ok) setApprovals(appr.items ?? []);
      if (tmpl.ok) setTemplates(tmpl.items ?? []);
      if (set.ok) {
        setSettings(set.settings);
        setTriggers(set.triggers ?? []);
        setActions(set.actions ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load automations.");
    } finally {
      setLoading(false);
    }
  }, [canApprove]);

  useEffect(() => {
    if (canView) void refresh();
  }, [canView, refresh]);

  const tabs = useMemo(
    () =>
      (
        [
          { id: "overview", label: "Overview", show: true },
          { id: "library", label: "Library", show: true },
          { id: "builder", label: "Builder", show: canCreate },
          { id: "history", label: "History", show: true },
          { id: "approvals", label: "Approvals", show: canApprove },
          { id: "templates", label: "Templates", show: true },
          { id: "settings", label: "Settings", show: canSettings },
        ] as const
      ).filter((t) => t.show),
    [canCreate, canApprove, canSettings],
  );

  const saveDraft = async (activate = false) => {
    setError("");
    setMessage("");
    const res = await fetch("/api/ai-operations/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        description: draft.description,
        triggerType: draft.triggerType,
        eventType: draft.triggerType === "EVENT" ? draft.eventType : null,
        scheduleExpression:
          draft.triggerType === "SCHEDULE" ? draft.scheduleExpression : null,
        riskLevel: draft.riskLevel,
        approvalMode: draft.approvalMode,
        conditions: { mode: "ALL", conditions: [] },
        actions: [{ actionKey: draft.actionKey }],
        status: activate ? "ACTIVE" : "DRAFT",
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setMessage(activate ? "Automation saved and activated." : "Draft saved.");
    setTab("library");
    await refresh();
  };

  const runAutomation = async (id: string, dryRun = true) => {
    const res = await fetch(`/api/ai-operations/automations/${id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dryRun }),
    });
    const json = await res.json();
    if (!json.ok) setError(json.error ?? "Run failed");
    else setMessage(`Run ${json.status}${json.skipped ? " (deduped)" : ""}.`);
    await refresh();
  };

  const setStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/ai-operations/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.ok) setError(json.error ?? "Update failed");
    else setMessage(`Status → ${status}`);
    await refresh();
  };

  const decide = async (executionId: string, approve: boolean) => {
    const note = approve ? "Approved" : "Rejected";
    if (approve && !window.confirm("Approve this high-impact automation continuation?")) {
      return;
    }
    const res = await fetch("/api/ai-operations/automations/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ executionId, approve, note }),
    });
    const json = await res.json();
    if (!json.ok) setError(json.error ?? "Decision failed");
    else setMessage(`Approval ${approve ? "granted" : "rejected"}.`);
    await refresh();
  };

  const createFromTemplate = async (templateId: string) => {
    const res = await fetch("/api/ai-operations/automations/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const json = await res.json();
    if (!json.ok) setError(json.error ?? "Template create failed");
    else {
      setMessage("Draft created from template.");
      setTab("library");
      await refresh();
    }
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-white">AI Automations</h1>
        <p className="mt-3 text-sm text-rose-300">
          You do not have permission to view AI Automations.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold text-white">AI Automations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Rule-based and AI-assisted automations with approval gates. Advisory actions
          only — no autonomous deletions, role changes, stock deductions, or external sends.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="AI Operations">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-lg border px-3 py-2 text-sm ${
              n.href === "/ai-operations/automations"
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                : "border-slate-800 text-slate-400"
            }`}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <p
        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
        role="note"
      >
        Automations can create notifications and drafts. High-impact actions pause for
        human approval. Dry-run is the default for manual tests.
      </p>

      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-300" role="status">
          {message}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}

      <nav className="flex flex-wrap gap-2" aria-label="Automation tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm ${
              tab === t.id
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                : "border-slate-800 text-slate-400"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && overview ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MatrixStatCard label="Active" value={String(overview.active)} />
            <MatrixStatCard label="Paused" value={String(overview.paused)} />
            <MatrixStatCard label="Runs today" value={String(overview.runsToday)} />
            <MatrixStatCard label="Succeeded" value={String(overview.succeededToday)} />
            <MatrixStatCard label="Failed" value={String(overview.failedToday)} />
            <MatrixStatCard
              label="Waiting approval"
              value={String(overview.waitingApprovals)}
            />
            <MatrixStatCard label="Health" value={String(overview.health)} />
            <MatrixStatCard
              label="Est. time saved (min)"
              value={String(overview.estimatedTimeSavedMinutes)}
            />
          </div>
          <MatrixCard title="Recent executions">
            {(overview.recentExecutions as Array<Record<string, unknown>>)?.length ? (
              <ul className="space-y-2 text-sm text-slate-300">
                {(overview.recentExecutions as Array<Record<string, unknown>>).map(
                  (e) => (
                    <li key={String(e.id)} className="border-b border-slate-800 py-2">
                      {String((e.automation as { name?: string })?.name ?? e.automationId)}{" "}
                      · {String(e.status)} ·{" "}
                      {e.createdAt
                        ? new Date(String(e.createdAt)).toLocaleString()
                        : ""}
                    </li>
                  ),
                )}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No executions yet.</p>
            )}
          </MatrixCard>
        </div>
      ) : null}

      {tab === "library" ? (
        <MatrixCard title="Automation library">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
              No automations yet. Create one in Builder or from Templates.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((a) => (
                <li
                  key={String(a.id)}
                  className="rounded-lg border border-slate-800 p-3 text-sm text-slate-200"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{String(a.name)}</p>
                      <p className="text-xs text-slate-500">
                        {String(a.status)} · {String(a.triggerType)} · risk{" "}
                        {String(a.riskLevel)}
                        {a.eventType ? ` · ${String(a.eventType)}` : ""}
                      </p>
                      <p className="mt-1 text-slate-400">{String(a.description || "")}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canRun ? (
                        <MatrixButton onClick={() => void runAutomation(String(a.id), true)}>
                          Dry run
                        </MatrixButton>
                      ) : null}
                      {canEdit && a.status === "ACTIVE" ? (
                        <MatrixButton onClick={() => void setStatus(String(a.id), "PAUSED")}>
                          Pause
                        </MatrixButton>
                      ) : null}
                      {canEdit && (a.status === "DRAFT" || a.status === "PAUSED") ? (
                        <MatrixButton
                          onClick={() => void setStatus(String(a.id), "ACTIVE")}
                        >
                          Activate
                        </MatrixButton>
                      ) : null}
                      <Link
                        href={`/ai-operations/automations/${String(a.id)}`}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-cyan-300"
                      >
                        Detail
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      ) : null}

      {tab === "builder" && canCreate ? (
        <MatrixCard title="New automation builder">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-400">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="text-sm text-slate-400">
              Risk level
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                value={draft.riskLevel}
                onChange={(e) => setDraft({ ...draft, riskLevel: e.target.value })}
              >
                {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400 sm:col-span-2">
              Description
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label className="text-sm text-slate-400">
              Trigger type
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                value={draft.triggerType}
                onChange={(e) => setDraft({ ...draft, triggerType: e.target.value })}
              >
                {["EVENT", "SCHEDULE", "MANUAL"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {draft.triggerType === "EVENT" ? (
              <label className="text-sm text-slate-400">
                Event
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  value={draft.eventType}
                  onChange={(e) => setDraft({ ...draft, eventType: e.target.value })}
                >
                  {triggers
                    .filter((t) => t.available)
                    .map((t) => (
                      <option key={String(t.key)} value={String(t.key)}>
                        {String(t.displayName)}
                      </option>
                    ))}
                </select>
              </label>
            ) : (
              <label className="text-sm text-slate-400">
                Schedule
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  value={draft.scheduleExpression}
                  onChange={(e) =>
                    setDraft({ ...draft, scheduleExpression: e.target.value })
                  }
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="every_15m">Every 15 minutes</option>
                </select>
              </label>
            )}
            <label className="text-sm text-slate-400">
              Approval mode
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                value={draft.approvalMode}
                onChange={(e) => setDraft({ ...draft, approvalMode: e.target.value })}
              >
                {[
                  "NONE",
                  "BEFORE_RUN",
                  "BEFORE_HIGH_IMPACT_ACTION",
                  "ALWAYS",
                ].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Primary action
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                value={draft.actionKey}
                onChange={(e) => setDraft({ ...draft, actionKey: e.target.value })}
              >
                {actions
                  .filter((a) => a.available)
                  .map((a) => (
                    <option key={String(a.key)} value={String(a.key)}>
                      {String(a.displayName)}
                      {a.highImpact ? " (high impact)" : ""}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <MatrixButton
              disabled={!draft.name.trim()}
              onClick={() => void saveDraft(false)}
            >
              Save draft
            </MatrixButton>
            {hasMatrixPermission(role, "ENABLE_AI_AUTOMATIONS") ? (
              <MatrixButton
                disabled={!draft.name.trim()}
                onClick={() => void saveDraft(true)}
              >
                Save & activate
              </MatrixButton>
            ) : null}
          </div>
        </MatrixCard>
      ) : null}

      {tab === "history" ? (
        <MatrixCard title="Execution history">
          {executions.length === 0 ? (
            <p className="text-sm text-slate-500">No execution history yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {executions.map((e) => (
                <li key={String(e.id)} className="rounded border border-slate-800 p-3">
                  <p className="text-white">
                    {String((e.automation as { name?: string })?.name ?? e.automationId)} ·{" "}
                    {String(e.status)}
                    {e.dryRun ? " · dry-run" : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {String(e.triggerSource)} · attempt {String(e.attemptNumber)} ·{" "}
                    {e.createdAt
                      ? new Date(String(e.createdAt)).toLocaleString()
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      ) : null}

      {tab === "approvals" && canApprove ? (
        <MatrixCard title="Approval queue">
          {approvals.length === 0 ? (
            <p className="text-sm text-slate-500">No pending approvals.</p>
          ) : (
            <ul className="space-y-3">
              {approvals.map((a) => (
                <li key={String(a.id)} className="rounded border border-slate-800 p-3 text-sm">
                  <p className="text-white">
                    {(a.execution as { automation?: { name?: string } })?.automation
                      ?.name ?? "Automation"}
                  </p>
                  <p className="text-slate-400">{String(a.reason)}</p>
                  <div className="mt-2 flex gap-2">
                    <MatrixButton
                      onClick={() =>
                        void decide(String((a.execution as { id: string }).id), true)
                      }
                    >
                      Approve
                    </MatrixButton>
                    <MatrixButton
                      onClick={() =>
                        void decide(String((a.execution as { id: string }).id), false)
                      }
                    >
                      Reject
                    </MatrixButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      ) : null}

      {tab === "templates" ? (
        <MatrixCard title="System templates">
          <ul className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <li key={String(t.id)} className="rounded border border-slate-800 p-3 text-sm">
                <p className="font-medium text-white">{String(t.name)}</p>
                <p className="mt-1 text-slate-400">{String(t.description)}</p>
                {canCreate ? (
                  <div className="mt-2">
                    <MatrixButton onClick={() => void createFromTemplate(String(t.id))}>
                      Create draft
                    </MatrixButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </MatrixCard>
      ) : null}

      {tab === "settings" && settings && canSettings ? (
        <MatrixCard title="Framework settings">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Enabled</dt>
              <dd className="text-white">{String(settings.automationEnabled)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Allow AI conditions</dt>
              <dd className="text-white">{String(settings.allowAiConditions)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Default approval</dt>
              <dd className="text-white">{String(settings.defaultApprovalMode)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Auto-pause failure threshold</dt>
              <dd className="text-white">{String(settings.autoPauseFailureThreshold)}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <MatrixButton
              onClick={() =>
                void fetch("/api/ai-operations/automations/settings", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    automationEnabled: !settings.automationEnabled,
                  }),
                }).then(() => refresh())
              }
            >
              Toggle framework enabled
            </MatrixButton>
          </div>
        </MatrixCard>
      ) : null}
    </div>
  );
}
