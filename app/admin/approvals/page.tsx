"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixCard, MatrixStatCard, MatrixStatusBadge } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import { approvalBadgeVariant } from "@/lib/approvals/badge";

type MetricCard = {
  key: string;
  label: string;
  value: number | string;
  href: string;
};

type ApprovalRow = {
  id: string;
  requestNumber: string;
  title: string;
  approvalType: string;
  requesterName: string | null;
  requesterDepartmentId: string | null;
  priority: string;
  status: string;
  assignedApproverName: string | null;
  requestedAmount: number | null;
  currency: string | null;
  submittedAt: string | null;
  dueAt: string | null;
  waitingTime: string;
  overdue: boolean;
};

function priorityClass(priority: string) {
  if (priority === "CRITICAL") return "ring-1 ring-rose-500/60 bg-rose-950/30";
  if (priority === "HIGH") return "bg-amber-950/20";
  return "";
}

function ApprovalCenterInner() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_APPROVAL_CENTER");
  const canCreate = hasMatrixPermission(role, "CREATE_APPROVAL_REQUEST");
  const canExport = hasMatrixPermission(role, "EXPORT_APPROVALS");
  const canManageRules = hasMatrixPermission(role, "MANAGE_APPROVAL_RULES");

  const [cards, setCards] = useState<MetricCard[]>([]);
  const [items, setItems] = useState<ApprovalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [priority, setPriority] = useState(searchParams.get("priority") ?? "");
  const [approvalType, setApprovalType] = useState(
    searchParams.get("approvalType") ?? "",
  );
  const [awaitingMe, setAwaitingMe] = useState(
    searchParams.get("awaitingMe") === "1",
  );
  const [myRequests, setMyRequests] = useState(
    searchParams.get("myRequests") === "1",
  );
  const [overdueOnly, setOverdueOnly] = useState(
    searchParams.get("overdueOnly") === "1",
  );
  const [escalatedOnly, setEscalatedOnly] = useState(
    searchParams.get("escalatedOnly") === "1",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", "20");
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (approvalType) params.set("approvalType", approvalType);
      if (awaitingMe) params.set("awaitingMe", "1");
      if (myRequests) params.set("myRequests", "1");
      if (overdueOnly) params.set("overdueOnly", "1");
      if (escalatedOnly) params.set("escalatedOnly", "1");

      const [metricsRes, listRes] = await Promise.all([
        fetch("/api/approvals/metrics"),
        fetch(`/api/approvals?${params.toString()}`),
      ]);
      const metricsJson = await metricsRes.json();
      const listJson = await listRes.json();
      if (!metricsJson.ok) throw new Error(metricsJson.error ?? "Metrics failed");
      if (!listJson.ok) throw new Error(listJson.error ?? "List failed");
      setCards(metricsJson.cards ?? []);
      setItems(listJson.items ?? []);
      setTotal(listJson.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [
    canView,
    page,
    q,
    status,
    priority,
    approvalType,
    awaitingMe,
    myRequests,
    overdueOnly,
    escalatedOnly,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archiveSelected() {
    if (selected.length === 0) return;
    setBulkMessage(null);
    const results: string[] = [];
    for (const id of selected) {
      const res = await fetch(`/api/approvals/${id}/archive`, { method: "POST" });
      const json = await res.json();
      results.push(json.ok ? `${id}: archived` : `${id}: ${json.error}`);
    }
    setBulkMessage(results.join("; "));
    setSelected([]);
    await load();
  }

  return (
    <AdminShell
      title="Approval Center"
      subtitle="Centralized review, approval, rejection, revision, assignment, and audit for Matrix modules."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view the Approval Center.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {canCreate ? (
              <Link
                href="/admin/approvals/new"
                className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
              >
                New request
              </Link>
            ) : null}
            {canManageRules ? (
              <Link
                href="/admin/approvals/rules"
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Approval rules
              </Link>
            ) : null}
            {canExport ? (
              <a
                href={`/api/approvals?export=csv&${new URLSearchParams({
                  ...(status ? { status } : {}),
                  ...(priority ? { priority } : {}),
                  ...(q ? { q } : {}),
                }).toString()}`}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Export CSV
              </a>
            ) : null}
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link key={card.key} href={card.href} className="block">
                <MatrixStatCard
                  label={card.label}
                  value={card.value}
                  trend="Live"
                />
              </Link>
            ))}
          </div>

          <MatrixCard title="Approval queue">
            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm text-slate-400">
                Search
                <input
                  value={q}
                  onChange={(e) => {
                    setPage(1);
                    setQ(e.target.value);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="Number, title, requester…"
                />
              </label>
              <label className="text-sm text-slate-400">
                Status
                <select
                  value={status}
                  onChange={(e) => {
                    setPage(1);
                    setStatus(e.target.value);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">All</option>
                  {[
                    "DRAFT",
                    "PENDING",
                    "IN_REVIEW",
                    "RETURNED_FOR_REVISION",
                    "APPROVED",
                    "REJECTED",
                    "CANCELLED",
                    "ESCALATED",
                    "COMPLETED",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-400">
                Priority
                <select
                  value={priority}
                  onChange={(e) => {
                    setPage(1);
                    setPriority(e.target.value);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">All</option>
                  {["CRITICAL", "HIGH", "NORMAL", "LOW"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-400">
                Type
                <select
                  value={approvalType}
                  onChange={(e) => {
                    setPage(1);
                    setApprovalType(e.target.value);
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">All</option>
                  {[
                    "PARTS_ORDER",
                    "PURCHASE_REQUEST",
                    "INVENTORY_ADJUSTMENT",
                    "EXPENSE_REQUEST",
                    "EMERGENCY_REQUEST",
                    "PM_SCHEDULE_CHANGE",
                    "USER_ACCESS_REQUEST",
                    "WARRANTY_CLAIM",
                    "GENERAL_REQUEST",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mb-4 flex flex-wrap gap-4 text-sm text-slate-300">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={awaitingMe}
                  onChange={(e) => {
                    setPage(1);
                    setAwaitingMe(e.target.checked);
                  }}
                />
                Awaiting me
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={myRequests}
                  onChange={(e) => {
                    setPage(1);
                    setMyRequests(e.target.checked);
                  }}
                />
                My requests
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(e) => {
                    setPage(1);
                    setOverdueOnly(e.target.checked);
                  }}
                />
                Overdue only
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={escalatedOnly}
                  onChange={(e) => {
                    setPage(1);
                    setEscalatedOnly(e.target.checked);
                  }}
                />
                Escalated only
              </label>
            </div>

            {selected.length > 0 ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void archiveSelected()}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Archive selected ({selected.length})
                </button>
                {bulkMessage ? (
                  <span className="text-xs text-slate-400">{bulkMessage}</span>
                ) : null}
              </div>
            ) : null}

            {loading ? (
              <p className="text-sm text-slate-400" aria-live="polite">
                Loading approvals…
              </p>
            ) : error ? (
              <p className="text-sm text-rose-300" role="alert">
                {error}
              </p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-400">
                No approval requests match the current filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-700 text-slate-400">
                    <tr>
                      <th className="px-2 py-2">
                        <span className="sr-only">Select</span>
                      </th>
                      <th className="px-2 py-2">Request</th>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Requester</th>
                      <th className="px-2 py-2">Priority</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Approver</th>
                      <th className="px-2 py-2">Amount</th>
                      <th className="px-2 py-2">Waiting</th>
                      <th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-slate-800/80 ${priorityClass(row.priority)}`}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selected.includes(row.id)}
                            onChange={(e) => {
                              setSelected((prev) =>
                                e.target.checked
                                  ? [...prev, row.id]
                                  : prev.filter((x) => x !== row.id),
                              );
                            }}
                            aria-label={`Select ${row.requestNumber}`}
                          />
                        </td>
                        <td className="px-2 py-2 font-mono text-xs text-sky-300">
                          {row.requestNumber}
                          {row.overdue ? (
                            <span className="ml-1 text-rose-400">Overdue</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-slate-100">{row.title}</td>
                        <td className="px-2 py-2 text-slate-300">
                          {row.approvalType}
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {row.requesterName ?? "—"}
                        </td>
                        <td className="px-2 py-2">
                          <MatrixStatusBadge
                            variant={approvalBadgeVariant(row.priority)}
                            label={row.priority}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <MatrixStatusBadge
                            variant={approvalBadgeVariant(row.status)}
                            label={row.status}
                          />
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {row.assignedApproverName ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-slate-300">
                          {row.requestedAmount != null
                            ? `${row.currency ?? "USD"} ${row.requestedAmount.toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-2 py-2 text-slate-400">
                          {row.waitingTime}
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            href={`/admin/approvals/${row.id}`}
                            className="text-sky-400 hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>
                {total} request{total === 1 ? "" : "s"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
                >
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  type="button"
                  disabled={page * 20 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </MatrixCard>
        </>
      )}
    </AdminShell>
  );
}

export default function ApprovalCenterPage() {
  return (
    <Suspense
      fallback={
        <AdminShell title="Approval Center" subtitle="">
          <p className="text-sm text-slate-400">Loading Approval Center…</p>
        </AdminShell>
      }
    >
      <ApprovalCenterInner />
    </Suspense>
  );
}
