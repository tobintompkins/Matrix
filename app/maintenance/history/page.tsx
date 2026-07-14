"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixEmptyState,
  MatrixPageHeader,
  MatrixSearchBar,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import {
  downloadPmHistoryCsv,
  fetchPmHistory,
  fetchPmHistoryRecord,
  type PmHistoryRow,
} from "@/lib/maintenance/pm-api-client";
import type {
  PmPartUsed,
  PmWorkflowChecklistItem,
} from "@/lib/maintenance/pm-checklist";

const PAGE_SIZE = 15;

type DetailRecord = PmHistoryRow & {
  checklist?: PmWorkflowChecklistItem[];
  partsUsed?: PmPartUsed[];
  workPerformed?: string | null;
  customerSignaturePlaceholder?: string | null;
};

export default function PmHistoryPage() {
  const [rows, setRows] = useState<PmHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [technician, setTechnician] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<DetailRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPmHistory({
        technician: technician.trim() || undefined,
        search: query.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        statusAtCompletion:
          statusFilter === "ALL" ? undefined : statusFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      if (!data.ok) {
        setError(data.error ?? "Failed to load history");
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [technician, query, fromDate, toDate, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, technician, fromDate, toDate, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function openRecord(id: string) {
    setDetailLoading(true);
    setError("");
    try {
      const res = await fetchPmHistoryRecord(id);
      if (!res.ok || !res.record) {
        setError(res.error ?? "Failed to open PM record");
        return;
      }
      setDetail(res.record as DetailRecord);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <MatrixShell title="PM History" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="PM History"
          subtitle="Frozen completion snapshots. Open a row for the full PM record."
          breadcrumbs={["Matrix", "Preventive Maintenance", "History"]}
          actions={
            <MatrixButton
              type="button"
              variant="secondary"
              onClick={() => {
                void downloadPmHistoryCsv({
                  technician: technician.trim() || undefined,
                  from: fromDate || undefined,
                  to: toDate || undefined,
                  search: query.trim() || undefined,
                  statusAtCompletion:
                    statusFilter === "ALL" ? undefined : statusFilter,
                }).catch((e) =>
                  setError(e instanceof Error ? e.message : "Export failed"),
                );
              }}
            >
              Export CSV
            </MatrixButton>
          }
        />
        <MaintenanceSubnav />

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <MatrixSearchBar
            value={query}
            onValueChange={setQuery}
            placeholder="Search machine, tech, notes, parts…"
            className="md:col-span-2"
          />
          <label className="block text-sm text-slate-400">
            From
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-400">
            To
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <label className="block text-sm text-slate-400">
            Technician filter
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              placeholder="Optional technician name"
            />
          </label>
          <label className="block text-sm text-slate-400">
            Status at completion
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="GOOD">GOOD</option>
              <option value="DUE_SOON">DUE_SOON</option>
              <option value="DUE">DUE</option>
              <option value="OVERDUE">OVERDUE</option>
              <option value="NOT_CONFIGURED">NOT_CONFIGURED</option>
            </select>
          </label>
        </div>

        {error ? (
          <p
            className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading history…</p>
        ) : rows.length === 0 ? (
          <MatrixEmptyState
            title="No PM history"
            description="Complete a PM from the machine detail workflow."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-800/90">
              <table className="min-w-[1200px] w-full text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-3 py-3">Completion date</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Machine</th>
                    <th className="px-3 py-3">Technician</th>
                    <th className="px-3 py-3">Labor</th>
                    <th className="px-3 py-3">Meter</th>
                    <th className="px-3 py-3">Checklist</th>
                    <th className="px-3 py-3">Quality</th>
                    <th className="px-3 py-3">Parts</th>
                    <th className="px-3 py-3">Notes</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    let partsLabel = "—";
                    if (r.partsUsedJson) {
                      try {
                        const parts = JSON.parse(r.partsUsedJson) as Array<{
                          partNumber: string;
                          quantity: number;
                        }>;
                        partsLabel =
                          parts.length === 0
                            ? "None"
                            : parts
                                .map((p) => `${p.partNumber}×${p.quantity}`)
                                .join(", ");
                      } catch {
                        partsLabel = "—";
                      }
                    }
                    return (
                      <tr key={r.id} className="border-t border-slate-800/80">
                        <td className="px-3 py-3 whitespace-nowrap">
                          {new Date(r.completedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-slate-400">
                          {r.customerName ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Link
                            href={`/maintenance/machines/${encodeURIComponent(r.machineId)}`}
                            className="text-cyan-300 hover:underline"
                          >
                            {r.nickname ?? r.machineId}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{r.technician}</td>
                        <td className="px-3 py-3 tabular-nums">
                          {r.laborMinutes != null ? `${r.laborMinutes}m` : "—"}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {r.countAtCompletion.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {r.checklistCompletionPct != null
                            ? `${r.checklistCompletionPct}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
                          {r.qualityScore != null ? `${r.qualityScore}%` : "—"}
                        </td>
                        <td className="px-3 py-3 text-slate-400">{partsLabel}</td>
                        <td className="px-3 py-3 text-slate-400">
                          {r.notes ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          {r.statusAtCompletion ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          <MatrixButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void openRecord(r.id)}
                          >
                            Open
                          </MatrixButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <p>
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <MatrixButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </MatrixButton>
                <span>
                  Page {page} of {totalPages}
                </span>
                <MatrixButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </MatrixButton>
              </div>
            </div>
          </>
        )}

        {(detail || detailLoading) && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center"
            role="presentation"
            onClick={() => setDetail(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="PM completion record"
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading || !detail ? (
                <p className="text-sm text-slate-400">Loading record…</p>
              ) : (
                <>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        PM Record
                      </h2>
                      <p className="text-sm text-slate-400">
                        {detail.nickname ?? detail.machineId} ·{" "}
                        {new Date(detail.completedAt).toLocaleString()}
                      </p>
                    </div>
                    <MatrixButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setDetail(null)}
                    >
                      Close
                    </MatrixButton>
                  </div>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Technician</dt>
                      <dd>{detail.technician}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Labor</dt>
                      <dd>
                        {detail.laborMinutes != null
                          ? `${detail.laborMinutes} min`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Meter</dt>
                      <dd>{detail.countAtCompletion.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Interval snapshot</dt>
                      <dd>
                        {detail.pmIntervalAtCompletion.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Quality score</dt>
                      <dd>
                        {detail.qualityScore != null
                          ? `${detail.qualityScore}%`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Status at completion</dt>
                      <dd>{detail.statusAtCompletion ?? "—"}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-sm text-slate-300">
                    Notes: {detail.notes ?? "—"}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Work performed: {detail.workPerformed ?? "—"}
                  </p>
                  <h3 className="mt-4 text-sm font-semibold text-slate-200">
                    Checklist snapshot
                  </h3>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                    {(detail.checklist ?? []).map((item) => (
                      <li key={item.itemKey} className="text-slate-400">
                        {item.taskName}: {item.status}
                        {item.skipReason ? ` (${item.skipReason})` : ""}
                      </li>
                    ))}
                  </ul>
                  <h3 className="mt-4 text-sm font-semibold text-slate-200">
                    Parts used
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-slate-400">
                    {(detail.partsUsed ?? []).length === 0 ? (
                      <li>None</li>
                    ) : (
                      (detail.partsUsed ?? []).map((p, i) => (
                        <li key={`${p.partNumber}-${i}`}>
                          {p.partNumber}
                          {p.partId ? ` [${p.partId}]` : ""} — {p.description} ×{" "}
                          {p.quantity}
                        </li>
                      ))
                    )}
                  </ul>
                  <p className="mt-4 text-xs text-slate-500">
                    Signature placeholder:{" "}
                    {detail.customerSignaturePlaceholder ?? "—"}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
