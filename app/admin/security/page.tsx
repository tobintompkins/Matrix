"use client";

import { useEffect, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixCard, MatrixStatCard } from "../../components/ui";

type SecurityData = {
  activeAdministrators: number;
  activeSuperAdministrators: number;
  usersWithRoleManagement: number;
  deactivatedUsers: number;
  pendingInvitations: number;
  recentAccessChanges: Array<{
    id: string;
    action: string;
    entityId: string | null;
    createdAt: string;
  }>;
  organizationIsolation: string;
  authenticationProvider: string;
  warnings: string[];
};

export default function AdminSecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/security", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Unable to load security center.");
        return;
      }
      setData(json.data);
    })();
  }, []);

  return (
    <AdminShell
      title="Security"
      subtitle="Reliable access warnings and authentication provider status. Secrets are never displayed."
    >
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : !data ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MatrixStatCard
              label="Active administrators"
              value={data.activeAdministrators}
            />
            <MatrixStatCard
              label="Super administrators"
              value={data.activeSuperAdministrators}
            />
            <MatrixStatCard
              label="Role-management users"
              value={data.usersWithRoleManagement}
            />
            <MatrixStatCard
              label="Deactivated users"
              value={data.deactivatedUsers}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <MatrixCard title="Authentication provider">
              <p className="text-sm text-slate-200">
                {data.authenticationProvider}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Secret keys and token values are never shown here.
              </p>
            </MatrixCard>
            <MatrixCard title="Organization isolation">
              <p className="text-sm text-slate-300">
                {data.organizationIsolation}
              </p>
            </MatrixCard>
            <MatrixCard title="Security warnings">
              {data.warnings.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No security warnings were detected.
                </p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">
                  {data.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </MatrixCard>
            <MatrixCard title="Recent access changes">
              {data.recentAccessChanges.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No recent access changes.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.recentAccessChanges.map((c) => (
                    <li key={c.id} className="rounded border border-slate-800 px-3 py-2">
                      <p className="text-slate-100">{c.action}</p>
                      <p className="text-xs text-slate-500">
                        {c.createdAt.slice(0, 19).replace("T", " ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </MatrixCard>
          </div>
        </>
      )}
    </AdminShell>
  );
}
