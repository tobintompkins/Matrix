"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminShell from "../../../components/admin/AdminShell";
import HighRiskConfirmDialog from "../../../components/admin/HighRiskConfirmDialog";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import {
  ELEVATED_ROLES,
  ROLE_CATALOG,
  getRoleDisplayName,
} from "@/lib/admin/types";
import type { MatrixRole } from "@/lib/auth/types";
import { getDefaultPermissionsForRole } from "@/lib/auth/permissions";

type UserDetail = {
  id: string;
  name: string;
  email: string;
  matrixRole: MatrixRole;
  status: string;
  isActive: boolean;
  primaryRegionId: string | null;
  managerId: string | null;
  accessScope: string;
  organizationId: string;
  createdAt: string;
  lastActiveAt: string | null;
  updatedAtVersion: number;
  deactivationReason: string | null;
  permissions: string[];
  roleDisplayName: string;
  displayStatus: string;
};

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newRole, setNewRole] = useState<MatrixRole | "">("");
  const [dialog, setDialog] = useState<"role" | "deactivate" | "reactivate" | null>(
    null,
  );

  async function load() {
    setError("");
    const res = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Unable to load user.");
      setUser(null);
      return;
    }
    setUser(data.user);
    setNewRole(data.user.matrixRole);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const permissionDiff = useMemo(() => {
    if (!user || !newRole || newRole === user.matrixRole) {
      return { added: [] as string[], removed: [] as string[] };
    }
    const current = new Set(getDefaultPermissionsForRole(user.matrixRole));
    const next = new Set(getDefaultPermissionsForRole(newRole));
    return {
      added: [...next].filter((p) => !current.has(p)),
      removed: [...current].filter((p) => !next.has(p)),
    };
  }, [user, newRole]);

  async function patch(body: Record<string, unknown>) {
    setNotice("");
    setError("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        expectedVersion: user?.updatedAtVersion,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Update failed.");
      return false;
    }
    setNotice("User updated successfully.");
    await load();
    return true;
  }

  return (
    <AdminShell title="User detail" subtitle="Administrative user profile">
      {error ? (
        <p className="mb-4 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-4 text-sm text-emerald-300" role="status">
          {notice}
        </p>
      ) : null}

      {!user ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <MatrixCard title={user.name}>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd>{user.displayStatus}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Role</dt>
                <dd>{user.roleDisplayName}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Organization</dt>
                <dd>{user.organizationId}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Region</dt>
                <dd>{user.primaryRegionId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Access scope</dt>
                <dd>{user.accessScope}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd>{user.createdAt.slice(0, 10)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last active</dt>
                <dd>
                  {user.lastActiveAt
                    ? user.lastActiveAt.slice(0, 19).replace("T", " ")
                    : "—"}
                </dd>
              </div>
              {user.deactivationReason ? (
                <div>
                  <dt className="text-slate-500">Deactivation reason</dt>
                  <dd>{user.deactivationReason}</dd>
                </div>
              ) : null}
            </dl>
          </MatrixCard>

          <MatrixCard title="Access actions">
            <label className="block text-sm text-slate-400">
              Change role
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as MatrixRole)}
              >
                {ROLE_CATALOG.filter((r) => r.category !== "customer").map(
                  (r) => (
                    <option key={r.role} value={r.role}>
                      {r.displayName}
                    </option>
                  ),
                )}
              </select>
            </label>
            {newRole && newRole !== user.matrixRole ? (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                <p>
                  Current: {getRoleDisplayName(user.matrixRole)} → New:{" "}
                  {getRoleDisplayName(newRole)}
                </p>
                <p className="mt-1">
                  Permissions added: {permissionDiff.added.length || "none"}
                </p>
                <p>Permissions removed: {permissionDiff.removed.length || "none"}</p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <MatrixButton
                type="button"
                variant="primary"
                disabled={!newRole || newRole === user.matrixRole}
                onClick={() => setDialog("role")}
              >
                Change Role
              </MatrixButton>
              {user.isActive ? (
                <MatrixButton
                  type="button"
                  variant="secondary"
                  onClick={() => setDialog("deactivate")}
                >
                  Deactivate Matrix Access
                </MatrixButton>
              ) : (
                <MatrixButton
                  type="button"
                  variant="secondary"
                  onClick={() => setDialog("reactivate")}
                >
                  Reactivate Matrix Access
                </MatrixButton>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Matrix preserves historical operational and audit records when user
              access is deactivated. Deactivation removes access but does not
              erase work history.
            </p>
          </MatrixCard>

          <MatrixCard title="Effective permissions" className="lg:col-span-2">
            <ul className="columns-1 gap-4 text-xs text-slate-400 sm:columns-2 lg:columns-3">
              {user.permissions.map((p) => (
                <li key={p} className="mb-1 break-inside-avoid font-mono">
                  {p}
                </li>
              ))}
            </ul>
          </MatrixCard>
        </div>
      )}

      <HighRiskConfirmDialog
        open={dialog === "role"}
        title="Confirm role change"
        summary="Role changes update Matrix application access. Elevated roles require a reason."
        currentValue={user ? getRoleDisplayName(user.matrixRole) : undefined}
        proposedValue={
          newRole ? getRoleDisplayName(newRole as MatrixRole) : undefined
        }
        requireReason={Boolean(newRole && ELEVATED_ROLES.includes(newRole))}
        onCancel={() => setDialog(null)}
        onConfirm={async (reason) => {
          const ok = await patch({
            action: "change_role",
            newRole,
            reason,
          });
          if (ok) setDialog(null);
        }}
      />

      <HighRiskConfirmDialog
        open={dialog === "deactivate"}
        title="Deactivate Matrix access"
        summary="The user will lose normal Matrix access. Historical records remain intact."
        confirmPhrase="DEACTIVATE"
        requireReason
        onCancel={() => setDialog(null)}
        onConfirm={async (reason) => {
          const ok = await patch({ action: "deactivate", reason });
          if (ok) setDialog(null);
        }}
      />

      <HighRiskConfirmDialog
        open={dialog === "reactivate"}
        title="Reactivate Matrix access"
        summary="Restore Matrix application access for this user."
        requireReason={false}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          const ok = await patch({ action: "reactivate" });
          if (ok) setDialog(null);
        }}
      />
    </AdminShell>
  );
}
