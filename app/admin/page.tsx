"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "../components/admin/AdminShell";
import { MatrixButton, MatrixCard, MatrixStatCard } from "../components/ui";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import { useUser } from "@clerk/nextjs";

type OverviewResponse = {
  ok: boolean;
  data?: {
    metrics: Record<string, number>;
    recentActivity: Array<{
      id: string;
      action: string;
      entityId: string | null;
      createdAt: string;
    }>;
    accessReview: Record<string, number | boolean>;
    configurationStatus: string[];
  };
  error?: string;
};

export default function AdminOverviewPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const [data, setData] = useState<OverviewResponse["data"] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/overview", { cache: "no-store" });
        const json = (await res.json()) as OverviewResponse;
        if (cancelled) return;
        if (!res.ok || !json.ok || !json.data) {
          setError(json.error ?? "Unable to load administration overview.");
          setData(null);
          return;
        }
        setData(json.data);
        setError("");
      } catch {
        if (!cancelled) setError("Unable to load administration overview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { href: "/admin", label: "Overview", permission: "VIEW_ADMIN_OVERVIEW" as const },
    { href: "/admin/executive", label: "Executive Dashboard", permission: "VIEW_EXECUTIVE_ADMIN_DASHBOARD" as const },
    { href: "/admin/users", label: "Users & Access", permission: "MANAGE_USERS" as const },
    { href: "/admin/roles", label: "Roles & Permissions", permission: "MANAGE_ROLES" as const },
    { href: "/admin/data", label: "Data Administration", permission: "VIEW_DATA_ADMINISTRATION" as const },
    { href: "/admin/reports", label: "Admin Reports", permission: "VIEW_ADMIN_REPORTS" as const },
    { href: "/admin/system-health", label: "System Health", permission: "VIEW_SYSTEM_HEALTH" as const },
    { href: "/admin/import-export", label: "Import & Export", permission: "EXPORT_OPERATIONAL_DATA" as const },
    { href: "/admin/tools", label: "Admin Tools", permission: "VIEW_ADMIN_TOOLS" as const },
    { href: "/admin/jobs", label: "Background Jobs", permission: "VIEW_BACKGROUND_JOBS" as const },
    { href: "/admin/backups", label: "Backups", permission: "VIEW_BACKUP_STATUS" as const },
    {
      href: "/admin/configuration",
      label: "System Configuration",
      permission: "MANAGE_SYSTEM_CONFIGURATION" as const,
    },
    {
      href: "/admin/organization",
      label: "Organization Settings",
      permission: "MANAGE_ORGANIZATION_SETTINGS" as const,
    },
    {
      href: "/admin/features",
      label: "Feature Controls",
      permission: "MANAGE_FEATURE_CONTROLS" as const,
    },
    { href: "/admin/audit", label: "Audit History", permission: "VIEW_AUDIT_HISTORY" as const },
    {
      href: "/admin/security",
      label: "Security",
      permission: "VIEW_SECURITY_CENTER" as const,
    },
    {
      href: "/admin/version",
      label: "Version & Deployment",
      permission: "VIEW_VERSION_INFORMATION" as const,
    },
  ].filter((c) => hasMatrixPermission(role, c.permission));

  return (
    <AdminShell
      title="Administration Center"
      subtitle="Users, access, operational data, system health, imports/exports, and audited maintenance tools."
    >
      <p className="mb-4 text-sm text-slate-400">
        Matrix administrative tools never provide unrestricted SQL, command-shell,
        source-code, credential, or file-system access. All administration actions
        are permission-controlled, scoped, validated, and audited.
      </p>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-cyan-500/40"
          >
            <p className="font-medium text-slate-100">{card.label}</p>
            <p className="mt-1 text-xs text-slate-500">Open section</p>
          </Link>
        ))}
      </div>

      {loading ? (
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-busy="true"
          aria-live="polite"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MatrixStatCard label="Active Users" value={data.metrics.activeUsers} />
            <MatrixStatCard
              label="Inactive Users"
              value={data.metrics.inactiveUsers}
            />
            <MatrixStatCard
              label="Pending Invitations"
              value={data.metrics.pendingInvitations}
            />
            <MatrixStatCard
              label="Administrative Users"
              value={data.metrics.administrativeUsers}
            />
            <MatrixStatCard label="Managers" value={data.metrics.managers} />
            <MatrixStatCard label="Directors" value={data.metrics.directors} />
            <MatrixStatCard
              label="Recent Role Changes"
              value={data.metrics.recentRoleChanges}
            />
            <MatrixStatCard
              label="Recent Admin Activity"
              value={data.metrics.recentAdminActivity}
            />
            <MatrixStatCard
              label="Configuration Alerts"
              value={data.metrics.configurationAlerts}
              status={
                data.metrics.configurationAlerts > 0 ? "watch" : "ok"
              }
            />
            <MatrixStatCard
              label="Security Alerts"
              value={data.metrics.securityAlerts}
              status={data.metrics.securityAlerts > 0 ? "attention" : "ok"}
            />
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {hasMatrixPermission(role, "MANAGE_USERS") ? (
              <MatrixButton href="/admin/users" variant="primary" size="md">
                Review Users
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "MANAGE_ROLES") ? (
              <MatrixButton href="/admin/roles" variant="secondary" size="md">
                Manage Permissions
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "MANAGE_SYSTEM_CONFIGURATION") ? (
              <MatrixButton
                href="/admin/configuration"
                variant="secondary"
                size="md"
              >
                Open System Configuration
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "VIEW_AUDIT_HISTORY") ? (
              <MatrixButton href="/admin/audit" variant="secondary" size="md">
                View Audit History
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "VIEW_SECURITY_CENTER") ? (
              <MatrixButton href="/admin/security" variant="secondary" size="md">
                Open Security Center
              </MatrixButton>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <MatrixCard title="Recent Administrative Activity">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No recent administrative activity.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.recentActivity.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg border border-slate-800 px-3 py-2"
                    >
                      <p className="font-medium text-slate-100">{a.action}</p>
                      <p className="text-xs text-slate-500">
                        {a.createdAt.slice(0, 19).replace("T", " ")}
                        {a.entityId ? ` · ${a.entityId}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </MatrixCard>

            <MatrixCard title="Access Review">
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  Elevated administrators:{" "}
                  {String(data.accessReview.elevatedUsers)}
                </li>
                <li>
                  Users without region:{" "}
                  {String(data.accessReview.usersWithoutRegion)}
                </li>
                <li>
                  Inactive users: {String(data.accessReview.inactiveUsers)}
                </li>
                <li>
                  Pending invitations:{" "}
                  {String(data.accessReview.pendingInvitations)}
                </li>
                {data.accessReview.administratorsRequiringReview ? (
                  <li className="text-amber-200">
                    Administrators requiring review: only one active admin
                    remains.
                  </li>
                ) : null}
              </ul>
            </MatrixCard>

            <MatrixCard title="Configuration Status" className="lg:col-span-2">
              {data.configurationStatus.length === 0 ? (
                <p className="text-sm text-slate-500">No configuration alerts.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">
                  {data.configurationStatus.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              )}
            </MatrixCard>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
