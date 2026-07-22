"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import {
  SIMULATABLE_ROLES,
  simulateRole,
} from "@/lib/admin/role-simulator";
import type { MatrixRole } from "@/lib/auth/types";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";

export default function RoleSimulatorPage() {
  const { user } = useUser();
  const { role: actorRole } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(actorRole, "VIEW_ROLE_SIMULATOR");
  const [role, setRole] = useState<MatrixRole>("FIELD_TECHNICIAN");

  const simulation = useMemo(() => simulateRole(role), [role]);

  if (!canView) {
    return (
      <AdminShell title="Role Simulator">
        <p className="text-sm text-rose-300">
          You do not have permission to use the Role Simulator.
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Role Simulator"
      subtitle="Preview what each Matrix role can access. This does not change live assignments or Clerk metadata."
    >
      <label className="mb-4 block max-w-md text-sm text-slate-400">
        Simulate role
        <select
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          value={role}
          onChange={(e) => setRole(e.target.value as MatrixRole)}
        >
          {SIMULATABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <p className="mb-4 text-sm text-slate-300">
        <span className="text-slate-500">Permissions:</span>{" "}
        {simulation.permissionCount}
        {simulation.isMasterRole ? (
          <span className="ml-2 text-emerald-300">· Master internal role</span>
        ) : null}
        {simulation.isCustomerRole ? (
          <span className="ml-2 text-amber-300">
            · Customer portal role (no master access)
          </span>
        ) : null}
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Surface</th>
              <th className="px-3 py-2">Permission</th>
              <th className="px-3 py-2">Access</th>
            </tr>
          </thead>
          <tbody>
            {simulation.surfaces.map((s) => (
              <tr key={s.href} className="border-t border-slate-800">
                <td className="px-3 py-2 text-white">{s.label}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-400">
                  {s.permission}
                </td>
                <td
                  className={`px-3 py-2 ${
                    s.allowed ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {s.allowed ? "Allowed" : "Denied"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
