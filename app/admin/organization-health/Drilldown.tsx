"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixCard, MatrixButton } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";

export function OrganizationHealthDrilldownPage({
  title,
  category,
  permission,
}: {
  title: string;
  category: string;
  permission: MatrixPermission;
}) {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, permission);
  const [items, setItems] = useState<unknown[]>([]);
  const [freshness, setFreshness] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/organization-health/${category}`, {
            cache: "no-store",
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            setError(json.error ?? "Unable to load.");
            return;
          }
          setItems(Array.isArray(json.items) ? json.items : []);
          setFreshness(json.freshness ?? "");
        } catch {
          setError("Unable to load.");
        }
      })();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, category]);

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    return JSON.stringify(item).toLowerCase().includes(search.toLowerCase());
  });

  if (!canView) {
    return (
      <AdminShell title={title}>
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={title} subtitle="Live drill-down from Organization Health">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/organization-health" className="text-sm text-cyan-300">
          ← Organization Health
        </Link>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white"
        />
        <MatrixButton
          href={`/api/organization-health/export`}
          variant="secondary"
          size="sm"
        >
          Export summary CSV
        </MatrixButton>
      </div>
      <p className="mb-3 text-xs text-slate-500">{freshness}</p>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {filtered.length === 0 ? (
        <MatrixCard title="Empty">
          <p className="text-sm text-slate-400">No records for this view.</p>
        </MatrixCard>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                {Object.keys(filtered[0] as object)
                  .slice(0, 8)
                  .map((h) => (
                    <th key={h} className="px-3 py-2">
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((row, idx) => {
                const obj = row as Record<string, unknown>;
                return (
                  <tr key={idx} className="border-t border-slate-800">
                    {Object.keys(obj)
                      .slice(0, 8)
                      .map((h) => (
                        <td key={h} className="px-3 py-2">
                          {String(obj[h] ?? "")}
                        </td>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
