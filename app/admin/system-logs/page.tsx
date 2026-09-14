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

type Summary = {
  ok: boolean;
  enabled?: boolean;
  message?: string;
  cards?: Record<string, number>;
  charts?: {
    byCategory: Array<{ key: string; count: number }>;
    bySeverity: Array<{ key: string; count: number }>;
    errorTrend: number[];
    topActors: Array<{ actorUserId: string; count: number }>;
  };
  recentCritical?: Array<{
    id: string;
    summary: string;
    severity: string;
    eventType: string;
  }>;
  recentAdministrativeActions?: Array<{
    id: string;
    summary: string;
    eventType: string;
  }>;
  limitations?: Record<string, string>;
  quickActions?: Array<{ label: string; href: string }>;
};

function num(v: unknown) {
  return typeof v === "number" ? String(v) : "—";
}

export default function SystemLogsDashboardPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_SYSTEM_LOGS");
  const canExport = hasMatrixPermission(role, "EXPORT_SYSTEM_LOGS");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/system-logs/summary", { cache: "no-store" });
      const json = (await res.json()) as Summary;
      if (!res.ok || !json.ok) {
        setError((json as { error?: string }).error ?? "Unable to load System Logs.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Unable to load System Logs.");
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

  if (!canView) {
    return (
      <AdminShell title="System Logs">
        <p className="text-sm text-rose-300">
          You do not have permission to view System Logs.
        </p>
      </AdminShell>
    );
  }

  const cards = data?.cards ?? {};

  return (
    <AdminShell
      title="System Logs"
      subtitle="Audit history, security events, API and error diagnostics. Sensitive values are redacted server-side."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/system-logs/events">
          <MatrixButton>Audit Explorer</MatrixButton>
        </Link>
        <Link href="/admin/system-logs/security">
          <MatrixButton variant="secondary">Security Events</MatrixButton>
        </Link>
        {canExport ? (
          <a href="/api/system-logs/export?kind=events">
            <MatrixButton variant="secondary">Export Current Logs</MatrixButton>
          </a>
        ) : null}
        <Link href="/admin/system-logs/retention">
          <MatrixButton variant="secondary">Manage Retention</MatrixButton>
        </Link>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading system logs…</p> : null}

      {!loading && data?.enabled === false ? (
        <p className="text-sm text-slate-300">{data.message}</p>
      ) : null}

      {!loading && data?.enabled ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <MatrixStatCard label="Events Today" value={num(cards.eventsToday)} />
            <MatrixStatCard label="Security Events" value={num(cards.securityEvents)} />
            <MatrixStatCard label="Failed Logins" value={num(cards.failedLogins)} />
            <MatrixStatCard label="API Errors" value={num(cards.apiErrors)} />
            <MatrixStatCard label="Application Errors" value={num(cards.applicationErrors)} />
            <MatrixStatCard
              label="Unresolved Critical"
              value={num(cards.unresolvedCriticalEvents)}
            />
            <MatrixStatCard
              label="Permission Changes"
              value={num(cards.permissionChanges)}
            />
            <MatrixStatCard label="Data Changes" value={num(cards.dataChanges)} />
            <MatrixStatCard label="Exports Today" value={num(cards.exportsToday)} />
            <MatrixStatCard
              label="Integration Failures"
              value={num(cards.integrationFailures)}
            />
            <MatrixStatCard
              label="Avg Error Rate %"
              value={num(cards.averageErrorRate)}
            />
            <MatrixStatCard
              label="Job Failures"
              value={num(cards.backgroundJobFailures)}
            />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <MatrixCard title="Recent Critical / Error Events">
              <ul className="space-y-2 text-sm">
                {(data.recentCritical ?? []).length === 0 ? (
                  <li className="text-slate-400">No recent critical/error events in the sample window.</li>
                ) : (
                  (data.recentCritical ?? []).map((e) => (
                    <li key={e.id}>
                      <Link
                        className="text-sky-300 hover:underline"
                        href={`/admin/system-logs/events/${e.id}`}
                      >
                        [{e.severity}] {e.summary || e.eventType}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </MatrixCard>
            <MatrixCard title="Events by Category">
              <ul className="space-y-1 text-sm">
                {(data.charts?.byCategory ?? []).map((r) => (
                  <li key={r.key} className="flex justify-between">
                    <span>{r.key}</span>
                    <span>{r.count}</span>
                  </li>
                ))}
              </ul>
            </MatrixCard>
            <MatrixCard title="Events by Severity">
              <ul className="space-y-1 text-sm">
                {(data.charts?.bySeverity ?? []).map((r) => (
                  <li key={r.key} className="flex justify-between">
                    <span>{r.key}</span>
                    <span>{r.count}</span>
                  </li>
                ))}
              </ul>
            </MatrixCard>
            <MatrixCard title="Recent Administrative Actions">
              <ul className="space-y-2 text-sm">
                {(data.recentAdministrativeActions ?? []).map((e) => (
                  <li key={e.id}>
                    <Link
                      className="text-sky-300 hover:underline"
                      href={`/admin/system-logs/events/${e.id}`}
                    >
                      {e.summary || e.eventType}
                    </Link>
                  </li>
                ))}
              </ul>
            </MatrixCard>
          </div>

          <MatrixCard title="Quick Actions" className="mb-6">
            <div className="flex flex-wrap gap-2">
              {(data.quickActions ?? []).map((a) =>
                a.href.startsWith("/api/") ? (
                  <a key={a.label} href={a.href}>
                    <MatrixButton variant="secondary">{a.label}</MatrixButton>
                  </a>
                ) : (
                  <Link key={a.label} href={a.href}>
                    <MatrixButton variant="secondary">{a.label}</MatrixButton>
                  </Link>
                ),
              )}
            </div>
          </MatrixCard>

          <MatrixCard title="Known limitations">
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-400">
              {Object.values(data.limitations ?? {}).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </MatrixCard>
        </>
      ) : null}
    </AdminShell>
  );
}
