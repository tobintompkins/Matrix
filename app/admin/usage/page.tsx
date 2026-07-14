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
  getUsageAnalytics,
  type UsageAdoptionSummary,
} from "@/lib/admin/completion/usage";

export default function AdminUsagePage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_USAGE_ANALYTICS");
  const [data, setData] = useState<UsageAdoptionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setData(getUsageAnalytics());
    setLoading(false);
  }, [canView]);

  return (
    <AdminShell
      title="Usage & Adoption"
      subtitle="Feature adoption from reliable operational stores. Personal tracking is not fabricated."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view usage analytics.
        </p>
      ) : loading || !data ? (
        <p className="text-sm text-slate-400">Loading usage analytics…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MatrixStatCard
              label="Service calls"
              value={data.totals.serviceCallsCreated}
            />
            <MatrixStatCard
              label="Inventory transactions"
              value={data.totals.inventoryTransactions}
            />
            <MatrixStatCard
              label="Active customers"
              value={data.totals.activeCustomers}
            />
            <MatrixStatCard
              label="Active machines"
              value={data.totals.activeMachines}
            />
            <MatrixStatCard
              label="Deleted records"
              value={data.totals.deletedRecords}
            />
          </div>

          <div className="mb-6 space-y-3">
            {data.modules.map((m) => (
              <MatrixCard
                key={m.feature}
                title={m.feature}
                subtitle={`Status: ${m.adoptionStatus}${m.enabled ? "" : " · Disabled"}`}
              >
                <p className="text-sm text-slate-300">
                  Recent usage (7 days / current): {m.recentUsage}
                </p>
                <p className="mt-1 text-sm text-slate-400">{m.detail}</p>
              </MatrixCard>
            ))}
          </div>

          <MatrixCard title="Notes">
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
              {data.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </MatrixCard>
        </>
      )}
    </AdminShell>
  );
}
