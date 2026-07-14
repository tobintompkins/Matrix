"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixCard, MatrixStatCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import {
  getExecutiveAdminSummary,
  type ExecutiveDateRange,
  type ExecutiveSummary,
} from "@/lib/admin/completion/executive";

const RANGE_OPTIONS: Array<{ value: ExecutiveDateRange; label: string }> = [
  { value: "TODAY", label: "Today" },
  { value: "LAST_7", label: "Last 7 days" },
  { value: "LAST_30", label: "Last 30 days" },
  { value: "QTD", label: "Quarter to date" },
  { value: "YTD", label: "Year to date" },
];

export default function AdminExecutivePage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_EXECUTIVE_ADMIN_DASHBOARD");
  const [range, setRange] = useState<ExecutiveDateRange>("LAST_30");
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(() => {
      setSummary(getExecutiveAdminSummary(range));
      setLoading(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [range, canView]);

  return (
    <AdminShell
      title="Executive Dashboard"
      subtitle="Organization-wide operational summary for directors and administrators. Soft-deleted records are excluded."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view the executive dashboard.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-400" htmlFor="exec-range">
              Date range
            </label>
            <select
              id="exec-range"
              value={range}
              onChange={(e) => setRange(e.target.value as ExecutiveDateRange)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {loading || !summary ? (
            <p className="text-sm text-slate-400">Loading executive dashboard…</p>
          ) : (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summary.cards.map((card) => (
                  <MatrixStatCard
                    key={card.key}
                    label={card.label}
                    value={card.value}
                    trend={card.detail}
                  />
                ))}
              </div>

              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <MatrixCard title="Service operations">
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Open</dt>
                      <dd className="text-slate-100">{summary.serviceOperations.open}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Critical / urgent</dt>
                      <dd className="text-slate-100">
                        {summary.serviceOperations.critical}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-400">Unassigned</dt>
                      <dd className="text-slate-100">
                        {summary.serviceOperations.unassigned}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        By priority
                      </p>
                      <ul className="space-y-1 text-sm text-slate-300">
                        {Object.entries(summary.serviceOperations.byPriority).map(
                          ([k, v]) => (
                            <li key={k} className="flex justify-between gap-2">
                              <span>{k}</span>
                              <span>{v}</span>
                            </li>
                          ),
                        )}
                        {Object.keys(summary.serviceOperations.byPriority).length ===
                        0 ? (
                          <li className="text-slate-500">No open calls.</li>
                        ) : null}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        By status
                      </p>
                      <ul className="space-y-1 text-sm text-slate-300">
                        {Object.entries(summary.serviceOperations.byStatus).map(
                          ([k, v]) => (
                            <li key={k} className="flex justify-between gap-2">
                              <span>{k}</span>
                              <span>{v}</span>
                            </li>
                          ),
                        )}
                        {Object.keys(summary.serviceOperations.byStatus).length ===
                        0 ? (
                          <li className="text-slate-500">No open calls.</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                </MatrixCard>

                <MatrixCard title="Notes">
                  <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                    {summary.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </MatrixCard>
              </div>
            </>
          )}
        </>
      )}
    </AdminShell>
  );
}
