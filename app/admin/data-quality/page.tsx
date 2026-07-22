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
  cards?: Record<string, unknown>;
  score?: {
    overallScore: number | null;
    classification: string;
    explanation: string;
    previousScore?: number | null;
    trend?: number | null;
    moduleScores?: Array<{
      module: string;
      score: number;
      classification: string;
      openIssueCount: number;
      criticalIssueCount: number;
    }>;
  };
  charts?: {
    bySeverity: Array<{ key: string; count: number }>;
    byType: Array<{ key: string; count: number }>;
    byModule: Array<{ key: string; count: number }>;
  };
  recentDetections?: Array<{
    id: string;
    title: string;
    severity: string;
    module: string;
  }>;
  recentlyResolved?: Array<{ id: string; title: string; severity: string }>;
  assignedToMe?: Array<{ id: string; title: string; severity: string }>;
  quickActions?: Array<{ label: string; href: string; action?: string }>;
  links?: Record<string, string>;
  settingsNote?: string | null;
};

function num(v: unknown) {
  return typeof v === "number" ? v : "—";
}

export default function DataQualityCenterPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_DATA_QUALITY_CENTER");
  const canScan = hasMatrixPermission(role, "RUN_DATA_QUALITY_SCAN");
  const canExport = hasMatrixPermission(role, "EXPORT_DATA_QUALITY");
  const [data, setData] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<
    Array<{ date: string; overallScore: number | null }>
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sumRes, trendRes] = await Promise.all([
        fetch("/api/data-quality/summary", { cache: "no-store" }),
        fetch("/api/data-quality/trends?days=30", { cache: "no-store" }),
      ]);
      const sum = (await sumRes.json()) as Summary;
      const tr = await trendRes.json();
      if (!sumRes.ok || !sum.ok) {
        setError(
          (sum as { message?: string; error?: string }).message ??
            (sum as { error?: string }).error ??
            "Unable to load Data Quality Center.",
        );
        setData(null);
        return;
      }
      setData(sum);
      setTrends(tr.points ?? []);
    } catch {
      setError("Unable to load Data Quality Center.");
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

  async function runScan() {
    if (!canScan) return;
    setBusy(true);
    try {
      const res = await fetch("/api/data-quality/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanType: "MANUAL" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Scan failed.");
      }
      await fetch("/api/data-quality/snapshot", { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <AdminShell title="Data Quality Center">
        <p className="text-sm text-rose-300">
          You do not have permission to view the Data Quality Center.
        </p>
      </AdminShell>
    );
  }

  const cards = data?.cards ?? {};

  return (
    <AdminShell
      title="Data Quality Center"
      subtitle="Live data health scoring, issue detection, guided cleanup, and controlled merges. Scans never modify source records."
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {canScan ? (
          <MatrixButton disabled={busy} onClick={() => void runScan()}>
            {busy ? "Scanning…" : "Run Data Scan"}
          </MatrixButton>
        ) : null}
        <Link href="/admin/data-quality/issues">
          <MatrixButton variant="secondary">Issue Queue</MatrixButton>
        </Link>
        <Link href="/admin/data-quality/merge">
          <MatrixButton variant="secondary">Merge Wizard</MatrixButton>
        </Link>
        <Link href="/admin/data-quality/rules">
          <MatrixButton variant="secondary">Manage Rules</MatrixButton>
        </Link>
        {canExport ? (
          <a href="/api/data-quality/export?kind=summary">
            <MatrixButton variant="secondary">Export Report</MatrixButton>
          </a>
        ) : null}
        <Link href="/admin/organization-health">
          <MatrixButton variant="secondary">Organization Health</MatrixButton>
        </Link>
      </div>

      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      {data?.settingsNote ? (
        <p className="mb-3 text-sm text-amber-200/90">{data.settingsNote}</p>
      ) : null}
      {loading ? (
        <p className="text-sm text-slate-400">Loading data quality…</p>
      ) : null}

      {!loading && data?.enabled === false ? (
        <p className="text-sm text-slate-300">{data.message}</p>
      ) : null}

      {!loading && data?.enabled ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <MatrixStatCard
              label="Overall Data Health"
              value={String(num(cards.overallDataHealthScore))}
              trend={String(cards.classification ?? "")}
            />
            <MatrixStatCard label="Open Issues" value={String(num(cards.openDataIssues))} />
            <MatrixStatCard label="Critical" value={String(num(cards.criticalIssues))} />
            <MatrixStatCard label="High Priority" value={String(num(cards.highPriorityIssues))} />
            <MatrixStatCard label="New (7d)" value={String(num(cards.newIssues))} />
            <MatrixStatCard label="Assigned" value={String(num(cards.assignedIssues))} />
            <MatrixStatCard label="Overdue" value={String(num(cards.overdueIssues))} />
            <MatrixStatCard
              label="Resolved This Month"
              value={String(num(cards.resolvedThisMonth))}
            />
            <MatrixStatCard
              label="Duplicate Candidates"
              value={String(num(cards.duplicateCandidates))}
            />
            <MatrixStatCard
              label="Missing Required"
              value={String(num(cards.missingRequiredFields))}
            />
            <MatrixStatCard label="Invalid Records" value={String(num(cards.invalidRecords))} />
            <MatrixStatCard label="Orphaned Records" value={String(num(cards.orphanedRecords))} />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <MatrixCard title="Data Health by Module">
              <ul className="space-y-2 text-sm">
                {(data.score?.moduleScores ?? []).length === 0 ? (
                  <li className="text-slate-400">No module findings yet — run a scan.</li>
                ) : (
                  (data.score?.moduleScores ?? []).map((m) => (
                    <li key={m.module} className="flex justify-between gap-2">
                      <span className="capitalize text-slate-200">{m.module}</span>
                      <span className="text-slate-400">
                        {m.score} · {m.openIssueCount} open · {m.criticalIssueCount} critical
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </MatrixCard>
            <MatrixCard title="Issues by Severity">
              <ul className="space-y-2 text-sm">
                {(data.charts?.bySeverity ?? []).map((r) => (
                  <li key={r.key} className="flex justify-between">
                    <span>{r.key}</span>
                    <span>{r.count}</span>
                  </li>
                ))}
                {(data.charts?.bySeverity ?? []).length === 0 ? (
                  <li className="text-slate-400">No open issues.</li>
                ) : null}
              </ul>
            </MatrixCard>
            <MatrixCard title="Issues by Type">
              <ul className="space-y-2 text-sm">
                {(data.charts?.byType ?? []).map((r) => (
                  <li key={r.key} className="flex justify-between">
                    <span>{r.key}</span>
                    <span>{r.count}</span>
                  </li>
                ))}
              </ul>
            </MatrixCard>
            <MatrixCard title="Data Quality Trend (snapshots)">
              {trends.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No snapshots yet. Running a scan creates one.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {trends.map((t) => (
                    <li key={t.date} className="flex justify-between">
                      <span>{t.date}</span>
                      <span>{t.overallScore ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </MatrixCard>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <MatrixCard title="Recent Detections">
              <ul className="space-y-2 text-sm">
                {(data.recentDetections ?? []).map((i) => (
                  <li key={i.id}>
                    <Link
                      className="text-sky-300 hover:underline"
                      href={`/admin/data-quality/issues/${i.id}`}
                    >
                      [{i.severity}] {i.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </MatrixCard>
            <MatrixCard title="Recently Resolved">
              <ul className="space-y-2 text-sm">
                {(data.recentlyResolved ?? []).map((i) => (
                  <li key={i.id} className="text-slate-300">
                    {i.title}
                  </li>
                ))}
              </ul>
            </MatrixCard>
            <MatrixCard title="Assigned to Me">
              <ul className="space-y-2 text-sm">
                {(data.assignedToMe ?? []).length === 0 ? (
                  <li className="text-slate-400">No issues assigned to you.</li>
                ) : (
                  (data.assignedToMe ?? []).map((i) => (
                    <li key={i.id}>
                      <Link
                        className="text-sky-300 hover:underline"
                        href={`/admin/data-quality/issues/${i.id}`}
                      >
                        [{i.severity}] {i.title}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </MatrixCard>
          </div>

          <MatrixCard title="Quick Actions">
            <div className="flex flex-wrap gap-2">
              {(data.quickActions ?? []).map((a) =>
                a.action === "scan" ? (
                  <MatrixButton
                    key={a.label}
                    variant="secondary"
                    disabled={!canScan || busy}
                    onClick={() => void runScan()}
                  >
                    {a.label}
                  </MatrixButton>
                ) : a.href.startsWith("/api/") ? (
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

          <p className="mt-4 text-xs text-slate-500">
            Last scan:{" "}
            {cards.lastScan
              ? JSON.stringify(cards.lastScan)
              : "None yet"}{" "}
            · Next scheduled: {String(cards.nextScheduledScan ?? "—")} · Score
            explanation: {data.score?.explanation}
          </p>
        </>
      ) : null}
    </AdminShell>
  );
}
