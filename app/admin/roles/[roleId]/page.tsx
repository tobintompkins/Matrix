"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixCard } from "../../../components/ui";
import { PERMISSION_GROUPS } from "@/lib/admin/permission-groups";
import { getRoleDescription, getRoleDisplayName } from "@/lib/admin/types";
import type { MatrixRole } from "@/lib/auth/types";
import { getDefaultPermissionsForRole } from "@/lib/auth/permissions";

export default function AdminRoleDetailPage() {
  const params = useParams<{ roleId: string }>();
  const roleId = params.roleId as MatrixRole;
  const enabled = useMemo(
    () => new Set(getDefaultPermissionsForRole(roleId)),
    [roleId],
  );

  return (
    <AdminShell
      title={getRoleDisplayName(roleId)}
      subtitle={getRoleDescription(roleId)}
    >
      <p className="mb-4 text-sm text-amber-200">
        Built-in role permissions are view-only in Patch 49A. Editing the live
        permission matrix requires Patch 49C advanced controls to avoid breaking
        operational modules. High-risk permissions are highlighted.
      </p>
      <div className="space-y-4">
        {PERMISSION_GROUPS.map((group) => (
          <MatrixCard key={group.id} title={group.label}>
            <ul className="space-y-2">
              {group.permissions.map((p) => {
                const on = enabled.has(p.code);
                return (
                  <li
                    key={p.code}
                    className="flex flex-col gap-1 rounded-lg border border-slate-800 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm text-slate-100">
                        {p.label}
                        {p.highRisk ? (
                          <span className="ml-2 text-xs text-amber-300">
                            High-risk
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">{p.description}</p>
                      <p className="font-mono text-[11px] text-slate-600">
                        {p.code}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        on ? "text-emerald-300" : "text-slate-500"
                      }`}
                    >
                      {on ? "Enabled" : "Disabled"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </MatrixCard>
        ))}
      </div>
    </AdminShell>
  );
}
