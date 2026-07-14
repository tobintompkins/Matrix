"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard, MatrixStatCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { SystemHealthSnapshot } from "@/lib/admin/completion/system-health";

type HealthResponse = {
  ok: boolean;
  data?: SystemHealthSnapshot;
  error?: string;
};

export default function AdminSystemHealthPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_SYSTEM_HEALTH");
  const [data, setData] = useState<SystemHealthSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/system-health", { cache: "no-store" });
      const json = (await res.json()) as HealthResponse;
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error ?? "Unable to load System Health.");
        setData(null);
        return;
      }
      setData(json.data);
    } catch {
      setError("Unable to load System Health.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void load();
  }, [canView]);

  return (
    <AdminShell
      title="System Health"
      subtitle="Live connectivity and configuration checks. Secrets are never displayed."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view system health.
        </p>
      ) : (
        <>
          <div className="mb-4">
            <MatrixButton type="button" size="sm" variant="secondary" onClick={() => void load()}>
              Refresh
            </MatrixButton>
          </div>

          {loading ? (
            <p className="text-sm text-slate-400">Loading system health…</p>
          ) : error ? (
            <p className="text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : data ? (
            <>
              <div className="mb-6">
                <MatrixStatCard
                  label="Overall status"
                  value={data.overall}
                  status={
                    data.overall === "Operational"
                      ? "ok"
                      : data.overall === "Unavailable"
                        ? "unavailable"
                        : "watch"
                  }
                />
                <p className="mt-2 text-sm text-slate-300">
                  Overall status text: {data.overall}
                </p>
              </div>

              <div className="mb-6 space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
                  Checks
                </h2>
                {data.checks.map((c) => (
                  <MatrixCard key={c.id} title={c.name} subtitle={`Status: ${c.status}`}>
                    <p className="text-sm text-slate-300">{c.summary}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Checked {c.checkedAt.slice(0, 19).replace("T", " ")} UTC
                    </p>
                  </MatrixCard>
                ))}
              </div>

              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <MatrixCard title="Alerts">
                  {data.alerts.length === 0 ? (
                    <p className="text-sm text-slate-500">No active health alerts.</p>
                  ) : (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">
                      {data.alerts.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                </MatrixCard>
                <MatrixCard title="Record counts">
                  <dl className="space-y-2 text-sm">
                    {Object.entries(data.recordCounts).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <dt className="text-slate-400">{k}</dt>
                        <dd className="text-slate-100">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                </MatrixCard>
              </div>
            </>
          ) : null}
        </>
      )}
    </AdminShell>
  );
}
