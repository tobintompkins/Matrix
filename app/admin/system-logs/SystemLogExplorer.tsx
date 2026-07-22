"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import type { MatrixPermission } from "@/lib/auth/types";

type EventRow = {
  id: string;
  occurredAt: string;
  severity: string;
  category: string;
  eventType: string;
  actorUserId: string | null;
  outcome: string;
  requestId: string | null;
  summary: string;
};

export function SystemLogExplorer(props: {
  title: string;
  subtitle: string;
  apiPath: string;
  permission: MatrixPermission;
  fixedCategory?: string;
}) {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, props.permission);
  const [items, setItems] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [severity, setSeverity] = useState(searchParams.get("severity") ?? "");
  const [outcome, setOutcome] = useState(searchParams.get("outcome") ?? "");
  const [requestId, setRequestId] = useState(
    searchParams.get("requestId") ?? "",
  );
  const [correlationId, setCorrelationId] = useState(
    searchParams.get("correlationId") ?? "",
  );
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (q) sp.set("q", q);
    if (severity) sp.set("severity", severity);
    if (outcome) sp.set("outcome", outcome);
    if (requestId) sp.set("requestId", requestId);
    if (correlationId) sp.set("correlationId", correlationId);
    if (props.fixedCategory) sp.set("category", props.fixedCategory);
    return sp.toString();
  }, [
    page,
    q,
    severity,
    outcome,
    requestId,
    correlationId,
    props.fixedCategory,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${props.apiPath}?${query}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Unable to load events.");
        setItems([]);
        return;
      }
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
      setNote(json.note ?? null);
    } catch {
      setError("Unable to load events.");
    } finally {
      setLoading(false);
    }
  }, [props.apiPath, query]);

  useEffect(() => {
    if (!canView) return;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [canView, load]);

  if (!canView) {
    return (
      <AdminShell title={props.title}>
        <p className="text-sm text-rose-300">Permission denied.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={props.title} subtitle={props.subtitle}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/system-logs">
          <MatrixButton variant="secondary">← Dashboard</MatrixButton>
        </Link>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          Search
          <input
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
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
            {["CRITICAL", "ERROR", "WARNING", "NOTICE", "INFO"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Outcome
          <select
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={outcome}
            onChange={(e) => {
              setPage(1);
              setOutcome(e.target.value);
            }}
          >
            <option value="">All</option>
            {["SUCCESS", "FAILURE", "DENIED", "PARTIAL"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          Request ID
          <input
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={requestId}
            onChange={(e) => {
              setPage(1);
              setRequestId(e.target.value);
            }}
          />
        </label>
        <label className="text-xs text-slate-400">
          Correlation ID
          <input
            className="mt-1 block rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            value={correlationId}
            onChange={(e) => {
              setPage(1);
              setCorrelationId(e.target.value);
            }}
          />
        </label>
      </div>
      {note ? <p className="mb-3 text-sm text-amber-200/90">{note}</p> : null}
      {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}
      <MatrixCard title={`Events (${total})`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Severity</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Event</th>
                <th className="px-2 py-2">Actor</th>
                <th className="px-2 py-2">Outcome</th>
                <th className="px-2 py-2">Request</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-t border-slate-800">
                  <td className="px-2 py-2 whitespace-nowrap">
                    {new Date(e.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2">{e.severity}</td>
                  <td className="px-2 py-2">{e.category}</td>
                  <td className="px-2 py-2">{e.summary || e.eventType}</td>
                  <td className="px-2 py-2">{e.actorUserId ?? "—"}</td>
                  <td className="px-2 py-2">{e.outcome}</td>
                  <td className="px-2 py-2 font-mono text-xs">
                    {e.requestId ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    <Link
                      className="text-sky-300 hover:underline"
                      href={`/admin/system-logs/events/${e.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-slate-400">
                    No events match the current filters.
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
