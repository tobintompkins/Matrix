"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";

type Issue = {
  id: string;
  severity: string;
  title: string;
  module: string;
  entityType: string;
  entityId: string;
  issueType: string;
  status: string;
  assignedToUserId: string | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  confidenceScore: number | null;
};

export default function DataQualityIssuesPage() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_DATA_QUALITY_ISSUES");
  const [items, setItems] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState(
    searchParams.get("severity") ?? "",
  );
  const [issueType, setIssueType] = useState(
    searchParams.get("issueType") ?? "",
  );
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const cleanupView = searchParams.get("view") === "cleanup";

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (q) sp.set("q", q);
    if (severity) sp.set("severity", severity);
    if (issueType) sp.set("issueType", issueType);
    if (status) sp.set("status", status);
    return sp.toString();
  }, [page, q, severity, issueType, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/data-quality/issues?${query}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Unable to load issues.");
        setItems([]);
        return;
      }
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setError("Unable to load issues.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, load]);

  if (!canView) {
    return (
      <AdminShell title="Data Quality Issues">
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Data Quality Issues"
      subtitle={
        cleanupView
          ? "Cleanup wizard — open an issue to preview recommended fixes."
          : "Filterable issue queue with assignment and resolution workflows."
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Link href="/admin/data-quality">
          <MatrixButton variant="secondary">← Dashboard</MatrixButton>
        </Link>
        <label className="text-xs text-slate-400">
          Search
          <input
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </label>
        <label className="text-xs text-slate-400">
          Severity
          <select
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={severity}
            onChange={(e) => {
              setPage(1);
              setSeverity(e.target.value);
            }}
          >
            <option value="">All</option>
            {["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Type
          <select
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={issueType}
            onChange={(e) => {
              setPage(1);
              setIssueType(e.target.value);
            }}
          >
            <option value="">All</option>
            {[
              "DUPLICATE",
              "MISSING_REQUIRED_VALUE",
              "INVALID_VALUE",
              "ORPHANED_RECORD",
              "BROKEN_RELATIONSHIP",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Status
          <select
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All open filters via empty</option>
            {[
              "OPEN",
              "ASSIGNED",
              "IN_REVIEW",
              "RESOLVED",
              "DISMISSED",
              "FALSE_POSITIVE",
              "REOPENED",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {canView && selected.length > 0 ? (
          <a
            href={`/api/data-quality/export?kind=issues`}
            className="text-xs text-sky-300"
          >
            Export selected scope ({selected.length} marked locally)
          </a>
        ) : null}
      </div>

      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}

      <MatrixCard title={`Issues (${total})`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-2 py-2">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2">Issue</th>
                <th className="px-2 py-2">Module</th>
                <th className="px-2 py-2">Entity</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Detected</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-slate-800">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${i.title}`}
                      checked={selected.includes(i.id)}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, i.id]
                            : prev.filter((x) => x !== i.id),
                        );
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">{i.severity}</td>
                  <td className="px-2 py-2">{i.title}</td>
                  <td className="px-2 py-2">{i.module}</td>
                  <td className="px-2 py-2">
                    {i.entityType}:{i.entityId}
                  </td>
                  <td className="px-2 py-2">{i.issueType}</td>
                  <td className="px-2 py-2">{i.status}</td>
                  <td className="px-2 py-2">
                    {new Date(i.firstDetectedAt).toLocaleDateString()}
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      className="text-sky-300 hover:underline"
                      href={`/admin/data-quality/issues/${i.id}`}
                    >
                      Review Issue
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-slate-400">
                    No issues match the current filters. Run a data scan to
                    detect problems.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          <MatrixButton
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </MatrixButton>
          <MatrixButton
            variant="secondary"
            disabled={page * 25 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </MatrixButton>
        </div>
      </MatrixCard>
    </AdminShell>
  );
}
