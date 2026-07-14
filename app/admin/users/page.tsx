"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton } from "../../components/ui";
import { ROLE_CATALOG, getRoleDisplayName } from "@/lib/admin/types";
import type { MatrixRole } from "@/lib/auth/types";

type UserRow = {
  id: string;
  name: string;
  email: string;
  matrixRole: string;
  status: string;
  isActive: boolean;
  primaryRegionId: string | null;
  organizationId: string;
  lastActiveAt: string | null;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextPage = page) {
    setLoading(true);
    setError("");
    const sp = new URLSearchParams({
      page: String(nextPage),
      pageSize: "20",
    });
    if (q.trim()) sp.set("q", q.trim());
    if (role) sp.set("role", role);
    if (status) sp.set("status", status);
    try {
      const res = await fetch(`/api/admin/users?${sp.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Unable to load users.");
        setItems([]);
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch {
      setError("Unable to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell
      title="Users & Access"
      subtitle="Search and manage Matrix application access. Deactivation preserves historical work."
    >
      <form
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void load(1);
        }}
      >
        <label className="text-sm text-slate-400">
          Search
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or email"
          />
        </label>
        <label className="text-sm text-slate-400">
          Role
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles</option>
            {ROLE_CATALOG.map((r) => (
              <option key={r.role} value={r.role}>
                {r.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-400">
          Status
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "Active",
              "Inactive",
              "Invited",
              "Pending",
              "Suspended",
              "Deactivated",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <MatrixButton type="submit" variant="primary" className="min-h-10 w-full">
            Apply filters
          </MatrixButton>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-slate-400" aria-live="polite">
          Loading users…
        </p>
      ) : error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No users match the selected filters.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Region</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-100">{u.name}</td>
                    <td className="px-3 py-2 text-slate-300">{u.email}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {getRoleDisplayName(u.matrixRole as MatrixRole)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {u.primaryRegionId ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          u.isActive ? "text-emerald-300" : "text-amber-200"
                        }
                      >
                        {u.isActive ? u.status : "Deactivated User"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-cyan-400 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
            <span>
              {total} user{total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => void load(page - 1)}
              >
                Previous
              </MatrixButton>
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={page * 20 >= total}
                onClick={() => void load(page + 1)}
              >
                Next
              </MatrixButton>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Clerk invitation workflow is not wired in Patch 49A. Use the Users
            directory for application access changes; identity invitations remain
            a future Clerk Backend integration.
          </p>
        </>
      )}
    </AdminShell>
  );
}
