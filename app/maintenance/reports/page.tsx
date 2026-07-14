"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixStatCard,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import PmCleaningStatusBadge from "../components/PmCleaningStatusBadge";
import {
  downloadPmReportsCsv,
  fetchPmReports,
} from "@/lib/maintenance/pm-api-client";

export default function PmReportsPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    total: number;
    active: number;
    overdue: number;
    due: number;
    dueSoon: number;
    good: number;
    notConfigured: number;
  } | null>(null);
  const [techActivity, setTechActivity] = useState<
    Array<{
      technician: string;
      completions: number;
      averageLaborMinutes: number | null;
    }>
  >([]);
  const [recent, setRecent] = useState<
    Array<{
      id: string;
      machineId: string;
      completedAt: string;
      technician: string;
      qualityScore?: number | null;
      customerName?: string | null;
    }>
  >([]);
  const [formula, setFormula] = useState<{
    version: string;
    weights: Record<string, number>;
    rules: readonly string[];
  } | null>(null);
  const [customerGroups, setCustomerGroups] = useState<
    Array<{
      customerName: string;
      total: number;
      due: number;
      overdue: number;
      good: number;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const reports = await fetchPmReports();
        if (cancelled) return;
        if (!reports.ok || !reports.data) {
          setError(reports.error ?? "Failed to load reports");
          return;
        }
        setSummary(reports.data.completionSummary);
        setTechActivity(reports.data.technicianActivity);
        setRecent(reports.data.recentHistory.slice(0, 20));
        if (reports.data.qualityScoreFormula) {
          setFormula(reports.data.qualityScoreFormula);
        }
        setCustomerGroups(reports.data.customerSummary ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load reports");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MatrixShell title="PM Reports" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="PM Reports"
          subtitle="Completion, technician activity, customer fleet health, and machine history exports."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Reports"]}
        />
        <MaintenanceSubnav />

        {error ? (
          <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading reports…</p>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MatrixStatCard
                label="Active machines"
                value={summary?.active ?? summary?.total ?? 0}
              />
              <MatrixStatCard
                label="Overdue PMs"
                value={summary?.overdue ?? 0}
                accent="text-rose-400"
              />
              <MatrixStatCard label="Due" value={summary?.due ?? 0} />
              <MatrixStatCard
                label="Good"
                value={summary?.good ?? 0}
                accent="text-emerald-400"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <MatrixCard title="PM Completion Report">
                <p className="text-sm text-slate-400">
                  Fleet status snapshot from Prisma PM state. Export full
                  completion history as CSV.
                </p>
                <div className="mt-4">
                  <MatrixButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void downloadPmReportsCsv("completion").catch((e) =>
                        setError(
                          e instanceof Error ? e.message : "Export failed",
                        ),
                      )
                    }
                  >
                    Export completion CSV
                  </MatrixButton>
                </div>
              </MatrixCard>

              <MatrixCard title="Technician PM Activity">
                <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                  {techActivity.length === 0 ? (
                    <li className="text-slate-500">No completions yet.</li>
                  ) : (
                    techActivity.map((t) => (
                      <li
                        key={t.technician}
                        className="flex justify-between gap-2 border-b border-slate-800/60 pb-1"
                      >
                        <span className="text-slate-200">{t.technician}</span>
                        <span className="text-slate-400">
                          {t.completions} PMs
                          {t.averageLaborMinutes != null
                            ? ` · avg ${t.averageLaborMinutes}m`
                            : ""}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-4">
                  <MatrixButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void downloadPmReportsCsv("technician").catch((e) =>
                        setError(
                          e instanceof Error ? e.message : "Export failed",
                        ),
                      )
                    }
                  >
                    Export activity CSV
                  </MatrixButton>
                </div>
              </MatrixCard>

              <MatrixCard title="Customer PM Summary">
                <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                  {customerGroups.length === 0 ? (
                    <li className="text-slate-500">No customer fleet data.</li>
                  ) : (
                    customerGroups.slice(0, 15).map((c) => (
                      <li
                        key={c.customerName}
                        className="flex justify-between gap-2 border-b border-slate-800/60 pb-1"
                      >
                        <span className="text-slate-200">{c.customerName}</span>
                        <span className="text-slate-400">
                          {c.total} machines · {c.overdue} overdue · {c.due} due
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-4">
                  <MatrixButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void downloadPmReportsCsv("customer").catch((e) =>
                        setError(
                          e instanceof Error ? e.message : "Export failed",
                        ),
                      )
                    }
                  >
                    Export customer CSV
                  </MatrixButton>
                </div>
              </MatrixCard>

              <MatrixCard title="Machine PM History (recent)">
                <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                  {recent.map((h) => (
                    <li key={h.id} className="border-b border-slate-800/60 pb-1">
                      <Link
                        href={`/maintenance/machines/${encodeURIComponent(h.machineId)}`}
                        className="text-cyan-300 hover:underline"
                      >
                        {h.machineId}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {new Date(h.completedAt).toLocaleString()} ·{" "}
                        {h.technician}
                        {h.qualityScore != null
                          ? ` · quality ${h.qualityScore}%`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-2">
                  <MatrixButton href="/maintenance/history" variant="secondary" size="sm">
                    Open full history
                  </MatrixButton>
                </div>
              </MatrixCard>
            </div>

            <MatrixCard title="Status legend" className="mt-4">
              <div className="flex flex-wrap gap-3 text-sm">
                {(
                  ["GOOD", "DUE_SOON", "DUE", "OVERDUE", "NOT_CONFIGURED"] as const
                ).map((s) => (
                  <PmCleaningStatusBadge key={s} status={s} />
                ))}
              </div>
            </MatrixCard>

            {formula ? (
              <MatrixCard
                title="Quality score methodology"
                className="mt-4"
                subtitle={`Formula version ${formula.version} — used by all PM screens`}
              >
                <ul className="space-y-1 text-sm text-slate-300">
                  {Object.entries(formula.weights).map(([k, v]) => (
                    <li key={k}>
                      <span className="text-slate-400">{k}</span>: max {v}
                    </li>
                  ))}
                </ul>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-400">
                  {formula.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </MatrixCard>
            ) : null}
          </>
        )}
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
