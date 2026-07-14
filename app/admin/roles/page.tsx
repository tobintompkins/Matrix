"use client";

import Link from "next/link";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixCard } from "../../components/ui";
import { FUTURE_ROLE_ALIASES, ROLE_CATALOG } from "@/lib/admin/types";
import { getDefaultPermissionsForRole } from "@/lib/auth/permissions";

export default function AdminRolesPage() {
  return (
    <AdminShell
      title="Roles & Permissions"
      subtitle="Built-in Matrix roles. Custom roles are not safely supported yet — architecture is prepared for a later phase."
    >
      <div className="grid gap-4">
        {ROLE_CATALOG.map((role) => {
          const perms = getDefaultPermissionsForRole(role.role);
          return (
            <MatrixCard
              key={role.role}
              title={role.displayName}
              subtitle={role.description}
              actions={
                <Link
                  href={`/admin/roles/${role.role}`}
                  className="text-sm text-cyan-400 hover:underline"
                >
                  View permissions
                </Link>
              }
            >
              <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="rounded border border-slate-700 px-2 py-1">
                  Built-in
                </span>
                <span className="rounded border border-slate-700 px-2 py-1">
                  {role.category}
                </span>
                <span className="rounded border border-slate-700 px-2 py-1">
                  {perms.length} permissions
                </span>
                <span className="rounded border border-slate-700 px-2 py-1 font-mono">
                  {role.role}
                </span>
              </div>
            </MatrixCard>
          );
        })}
      </div>

      <MatrixCard title="Mapped display concepts" className="mt-6">
        <ul className="space-y-2 text-sm text-slate-400">
          {FUTURE_ROLE_ALIASES.map((alias) => (
            <li key={alias.displayName}>
              <span className="text-slate-200">{alias.displayName}</span> →{" "}
              {alias.mapsTo}: {alias.note}
            </li>
          ))}
        </ul>
      </MatrixCard>
    </AdminShell>
  );
}
