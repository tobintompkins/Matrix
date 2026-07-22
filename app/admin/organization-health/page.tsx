"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

type Category = {
  key: string;
  score: number | null;
  classification: string;
  weight: number;
  weightedContribution: number | null;
  positiveFactors?: string[];
  negativeFactors?: string[];
  recommendedActions?: string[];
  dataSource?: string;
};

type Summary = {
  ok: boolean;
  enabled?: boolean;
  message?: string;
  freshness?: string;
  score?: {
    overallScore: number | null;
    classification: string;
    explanation: string;
    categories: Category[];
    scoreChange?: { label: string; absolute: number | null };
  };
  executiveKpis?: Array<{
    key: string;
    label: string;
    current: number | string | null;
    status: string;
    changeLabel?: string;
    dataPeriod?: string;
  }>;
  alerts?: Array<{
    id: string;
    severity: string;
    title: string;
    description: string;
    status: string;
    recommendedAction?: string | null;
  }>;
  actionCenter?: {
    approvalsBlocking: {
      pending: number;
      overdue: number;
      critical: number;
      href: string;
    };
  };
  portalMetrics?: Record<string, number>;
  links?: Record<string, string>;
  dataQuality?: {
    enabled?: boolean;
    dataHealthScore?: number | null;
    openCriticalIssues?: number;
    duplicateRecordCount?: number;
    missingRequiredCount?: number;
    orphanedRecordCount?: number;
    href?: string;
  };
  systemLogs?: {
    enabled?: boolean;
    criticalSecurityEvents?: number;
    unresolvedCriticalEvents?: number;
    apiErrorCountToday?: number;
    applicationErrorCountToday?: number;
    href?: string;
  };
};

function classColor(c: string) {
  if (c === "Excellent" || c === "Healthy") return "text-emerald-300";
  if (c === "Watch") return "text-amber-300";
  if (c === "At Risk" || c === "Critical") return "text-rose-300";
  return "text-slate-400";
}

export default function OrganizationHealthPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_ORGANIZATION_HEALTH");
  const canExport = hasMatrixPermission(role, "EXPORT_ORGANIZATION_HEALTH");
  const [data, setData] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<
    Array<{ date: string; overallScore: number | null }>
  >([]);
  const [trendNote, setTrendNote] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sumRes, trendRes] = await Promise.all([
        fetch("/api/organization-health/summary", { cache: "no-store" }),
        fetch("/api/organization-health/trends?days=30", { cache: "no-store" }),
      ]);
      const sum = (await sumRes.json()) as Summary;
      const tr = await trendRes.json();
      if (!sumRes.ok || !sum.ok) {
        setError(sum.message ?? "Unable to load Organization Health.");
        setData(null);
        return;
      }
      setData(sum);
      setTrends(tr.points ?? []);
      setTrendNote(tr.note ?? null);
    } catch {
      setError("Unable to load Organization Health.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, load]);

  async function createSnapshot() {
    setBusy(true);
    try {
      await fetch("/api/organization-health/snapshot", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <AdminShell title="Organization Health">
        <p className="text-sm text-rose-300">
          You do not have permission to view Organization Health.
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Organization Health"
      subtitle="Live operational health across fleet, service, PM, inventory, technicians, customers, approvals, and portal activity."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <MatrixButton
          type="button"
          variant="secondary"
          size="md"
          onClick={() => void load()}
        >
          Refresh
        </MatrixButton>
        <MatrixButton
          type="button"
          variant="secondary"
          size="md"
          disabled={busy}
          onClick={() => void createSnapshot()}
        >
          Create snapshot
        </MatrixButton>
        {canExport ? (
          <MatrixButton
            href="/api/organization-health/export"
            variant="secondary"
            size="md"
          >
            Export CSV
          </MatrixButton>
        ) : null}
        <MatrixButton
          href="/admin/organization-health/settings"
          variant="secondary"
          size="md"
        >
          Settings
        </MatrixButton>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading live health metrics…</p>
      ) : null}
      {error ? (
        <p className="mb-4 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {data?.enabled === false ? (
        <MatrixCard title="Disabled">
          <p className="text-sm text-slate-300">{data.message}</p>
        </MatrixCard>
      ) : null}

      {data?.score ? (
        <>
          <p className="mb-3 text-xs text-slate-500" aria-live="polite">
            Data freshness: {data.freshness}
          </p>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MatrixStatCard
              label="Overall Health Score"
              value={
                data.score.overallScore == null
                  ? "N/A"
                  : data.score.overallScore
              }
            />
            <MatrixCard title="Classification">
              <p className={`text-2xl font-semibold ${classColor(data.score.classification)}`}>
                {data.score.classification}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Change: {data.score.scoreChange?.label ?? "No Previous Data"}
                {data.score.scoreChange?.absolute != null
                  ? ` (${data.score.scoreChange.absolute})`
                  : ""}
              </p>
            </MatrixCard>
            <MatrixStatCard
              label="Critical Alerts"
              value={
                data.alerts?.filter((a) => a.severity === "CRITICAL").length ??
                0
              }
            />
            <MatrixStatCard
              label="Open Alerts"
              value={data.alerts?.length ?? 0}
            />
          </div>

          {data.dataQuality?.enabled ? (
            <MatrixCard title="Data Quality" className="mb-6">
              <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MatrixStatCard
                  label="Data Health Score"
                  value={data.dataQuality.dataHealthScore ?? "N/A"}
                />
                <MatrixStatCard
                  label="Critical DQ Issues"
                  value={data.dataQuality.openCriticalIssues ?? 0}
                />
                <MatrixStatCard
                  label="Duplicates"
                  value={data.dataQuality.duplicateRecordCount ?? 0}
                />
                <MatrixStatCard
                  label="Missing / Orphaned"
                  value={`${data.dataQuality.missingRequiredCount ?? 0} / ${data.dataQuality.orphanedRecordCount ?? 0}`}
                />
              </div>
              <MatrixButton
                href={data.dataQuality.href ?? "/admin/data-quality"}
                variant="secondary"
                size="md"
              >
                Open Data Quality Center
              </MatrixButton>
            </MatrixCard>
          ) : null}

          {data.systemLogs?.enabled ? (
            <MatrixCard title="System Logs" className="mb-6">
              <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MatrixStatCard
                  label="Critical Security Events"
                  value={data.systemLogs.criticalSecurityEvents ?? 0}
                />
                <MatrixStatCard
                  label="Unresolved Critical"
                  value={data.systemLogs.unresolvedCriticalEvents ?? 0}
                />
                <MatrixStatCard
                  label="API Errors Today"
                  value={data.systemLogs.apiErrorCountToday ?? 0}
                />
                <MatrixStatCard
                  label="App Errors Today"
                  value={data.systemLogs.applicationErrorCountToday ?? 0}
                />
              </div>
              <MatrixButton
                href={data.systemLogs.href ?? "/admin/system-logs"}
                variant="secondary"
                size="md"
              >
                Open System Logs
              </MatrixButton>
            </MatrixCard>
          ) : null}

          <MatrixCard title="Score explanation" className="mb-6">
            <p className="text-sm text-slate-300">{data.score.explanation}</p>
          </MatrixCard>

          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data.executiveKpis ?? []).map((k) => (
              <MatrixCard key={k.key} title={k.label}>
                <p className="text-2xl font-semibold text-white">
                  {k.current == null ? "Not Available" : String(k.current)}
                </p>
                <p className={`text-sm ${classColor(k.status)}`}>{k.status}</p>
                <p className="text-xs text-slate-500">{k.dataPeriod}</p>
              </MatrixCard>
            ))}
          </div>

          <h2 className="mb-3 text-lg font-semibold text-white">
            Health categories
          </h2>
          <div className="mb-8 grid gap-4 lg:grid-cols-2">
            {data.score.categories.map((c) => (
              <MatrixCard
                key={c.key}
                title={`${c.key.toUpperCase()} · ${c.classification}`}
                subtitle={`Weight ${c.weight}% · Contribution ${c.weightedContribution ?? "—"}`}
              >
                <p className={`text-3xl font-semibold ${classColor(c.classification)}`}>
                  {c.score == null ? "Not Available" : c.score}
                </p>
                <p className="mt-2 text-xs text-slate-500">{c.dataSource}</p>
                <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                  <div>
                    <p className="font-medium text-emerald-300">Positive</p>
                    <ul className="list-disc pl-4">
                      {(c.positiveFactors ?? []).slice(0, 3).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-amber-300">Negative</p>
                    <ul className="list-disc pl-4">
                      {(c.negativeFactors ?? []).slice(0, 3).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {(c.recommendedActions ?? []).length ? (
                  <p className="mt-2 text-xs text-cyan-200">
                    Recommended: {(c.recommendedActions ?? []).join("; ")}
                  </p>
                ) : null}
                {data.links?.[c.key === "technician" ? "technicians" : c.key === "customer" ? "customers" : c.key] ? (
                  <Link
                    href={
                      data.links[
                        c.key === "technician"
                          ? "technicians"
                          : c.key === "customer"
                            ? "customers"
                            : c.key
                      ]!
                    }
                    className="mt-3 inline-block text-sm text-cyan-300 hover:underline"
                  >
                    Open drill-down
                  </Link>
                ) : null}
              </MatrixCard>
            ))}
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            <MatrixCard title="Trend (30 days)">
              {trendNote ? (
                <p className="text-sm text-slate-400">{trendNote}</p>
              ) : null}
              {trends.length === 0 ? (
                <p className="text-sm text-slate-500">Insufficient Data</p>
              ) : (
                <ul className="space-y-1 text-sm text-slate-300">
                  {trends.map((p) => (
                    <li key={p.date} className="flex justify-between gap-3">
                      <span>{p.date}</span>
                      <span>
                        {p.overallScore == null ? "—" : p.overallScore}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </MatrixCard>

            <MatrixCard title="Executive action center">
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  Approvals pending:{" "}
                  {data.actionCenter?.approvalsBlocking.pending ?? 0} · overdue:{" "}
                  {data.actionCenter?.approvalsBlocking.overdue ?? 0}{" "}
                  <Link
                    href={data.actionCenter?.approvalsBlocking.href ?? "/admin/approvals"}
                    className="text-cyan-300 hover:underline"
                  >
                    Open Approval Center
                  </Link>
                </li>
                <li>
                  Portal active users:{" "}
                  {data.portalMetrics?.portalActiveUsers ?? 0} · parts pending:{" "}
                  {data.portalMetrics?.portalPartsPending ?? 0}{" "}
                  <Link
                    href="/admin/portal"
                    className="text-cyan-300 hover:underline"
                  >
                    Portal admin
                  </Link>
                </li>
                <li>
                  <Link
                    href="/admin/organization-health/alerts"
                    className="text-cyan-300 hover:underline"
                  >
                    View all operational alerts
                  </Link>
                </li>
              </ul>
            </MatrixCard>
          </div>

          <MatrixCard title="Critical / open alerts">
            {(data.alerts ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No open operational alerts.</p>
            ) : (
              <ul className="space-y-3">
                {(data.alerts ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-slate-800 p-3 text-sm"
                  >
                    <p className="font-medium text-white">
                      <span className={classColor(a.severity === "CRITICAL" ? "Critical" : "Watch")}>
                        {a.severity}
                      </span>{" "}
                      · {a.title}
                    </p>
                    <p className="text-slate-400">{a.description}</p>
                    {a.recommendedAction ? (
                      <p className="mt-1 text-xs text-cyan-200">
                        {a.recommendedAction}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </MatrixCard>
        </>
      ) : null}
    </AdminShell>
  );
}
