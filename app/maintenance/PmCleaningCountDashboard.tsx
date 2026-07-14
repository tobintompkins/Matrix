"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixSearchBar,
  MatrixStatCard,
} from "../components/ui";
import type { PmCleaningStatus } from "@/lib/maintenance/pm-status";
import type { PmDashboardRow, PmDashboardSummary } from "@/lib/maintenance/pm-prisma-repository";
import {
  fetchPmDashboard,
  newIdempotencyKey,
  postCompletePm,
  postPmInterval,
} from "@/lib/maintenance/pm-api-client";
import PmCleaningStatusBadge from "./components/PmCleaningStatusBadge";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";

const STATUS_FILTERS: Array<{ id: PmCleaningStatus | "ALL"; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "DUE", label: "Due" },
  { id: "DUE_SOON", label: "Due Soon" },
  { id: "GOOD", label: "Good" },
  { id: "NOT_CONFIGURED", label: "Not Configured" },
];

type SortKey =
  | "countsRemaining"
  | "nextPmDueCount"
  | "lastPmAt"
  | "customerName";

const PAGE_SIZE = 10;

const emptySummary: PmDashboardSummary = {
  total: 0,
  notConfigured: 0,
  good: 0,
  dueSoon: 0,
  due: 0,
  overdue: 0,
  active: 0,
};

export default function PmCleaningCountDashboard() {
  const canComplete = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "COMPLETE_MAINTENANCE",
  );
  const canEditInterval = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "EDIT_MAINTENANCE_INTERVALS",
  );

  const [rows, setRows] = useState<PmDashboardRow[]>([]);
  const [summary, setSummary] = useState<PmDashboardSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusFilter, setStatusFilter] = useState<PmCleaningStatus | "ALL">(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("countsRemaining");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [completeMachineId, setCompleteMachineId] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPmDashboard({
        status: statusFilter,
        search: search.trim() || undefined,
        customerName: customerFilter.trim() || undefined,
        assignedTechnician: techFilter.trim() || undefined,
      });
      if (!data.ok) {
        setError(data.error ?? "Failed to load PM dashboard");
        setRows([]);
        setSummary(emptySummary);
        return;
      }
      setRows(data.rows ?? []);
      setSummary(data.summary ?? emptySummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load PM dashboard");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, customerFilter, techFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, customerFilter, techFilter, sortKey, sortAsc]);

  const customers = useMemo(() => {
    return [...new Set(rows.map((r) => r.customerName).filter(Boolean))] as string[];
  }, [rows]);

  const technicians = useMemo(() => {
    return [
      ...new Set(rows.map((r) => r.assignedTechnician).filter(Boolean)),
    ] as string[];
  }, [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  async function handleComplete(row: PmDashboardRow) {
    if (!canComplete || submitting) return;
    if (row.pmInterval == null) {
      setError("Configure a PM interval before completing a PM.");
      return;
    }
    const count = row.currentMeterCount;
    if (count == null) {
      setError("Enter a current meter reading before completing a PM.");
      return;
    }
    const technician =
      row.assignedTechnician?.trim() ||
      window.prompt("Technician name") ||
      "";
    if (!technician.trim()) {
      setError("Technician is required.");
      return;
    }
    const confirmed = window.confirm(
      `Record PM for ${row.nickname ?? row.machineId} at count ${count.toLocaleString()}?`,
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setNotice("");
    setCompleteMachineId(row.machineId);
    try {
      const result = await postCompletePm({
        machineId: row.machineId,
        countAtCompletion: count,
        technician: technician.trim(),
        recordedBy: technician.trim(),
        notes: "PM completed from cleaning count dashboard",
        idempotencyKey: newIdempotencyKey("pm-complete"),
      });
      if (!result.ok) {
        setError(result.error ?? "Complete PM failed");
        return;
      }
      setNotice(
        result.idempotent
          ? "PM already recorded (duplicate submission prevented)."
          : `PM recorded for ${row.machineId}.`,
      );
      await load();
    } finally {
      setSubmitting(false);
      setCompleteMachineId(null);
    }
  }

  async function handleConfigureInterval(row: PmDashboardRow) {
    if (!canEditInterval) return;
    const defaultInterval =
      row.modelDefaultInterval ?? row.pmInterval ?? 1_000_000;
    const raw = window.prompt(
      `Set PM interval (impressions) for ${row.nickname ?? row.machineId}.\nModel default: ${defaultInterval.toLocaleString()}.\nLeave blank to clear (Not Configured).`,
      String(row.pmInterval ?? defaultInterval),
    );
    if (raw === null) return;
    const trimmed = raw.trim();
    const interval = trimmed === "" ? null : Number(trimmed);
    if (interval !== null && (!Number.isInteger(interval) || interval <= 0)) {
      setError("PM interval must be a positive whole number.");
      return;
    }
    setError("");
    const result = await postPmInterval({
      machineId: row.machineId,
      interval,
      actor: "Service Manager",
    });
    if (!result.ok) {
      setError(result.error ?? "Failed to update interval");
      return;
    }
    setNotice(
      interval == null
        ? `PM interval cleared for ${row.machineId}`
        : `PM interval set to ${interval.toLocaleString()} for ${row.machineId}`,
    );
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(
          [
            {
              id: "OVERDUE" as const,
              label: "Machines Overdue",
              value: summary.overdue,
              status: summary.overdue > 0 ? ("attention" as const) : ("ok" as const),
            },
            {
              id: "DUE" as const,
              label: "Machines Due",
              value: summary.due,
              status: summary.due > 0 ? ("watch" as const) : ("ok" as const),
            },
            {
              id: "DUE_SOON" as const,
              label: "Machines Due Soon",
              value: summary.dueSoon,
              status: summary.dueSoon > 0 ? ("watch" as const) : ("ok" as const),
            },
            {
              id: "GOOD" as const,
              label: "Good Standing",
              value: summary.good,
              status: "ok" as const,
            },
            {
              id: "NOT_CONFIGURED" as const,
              label: "Missing PM Configuration",
              value: summary.notConfigured,
              status:
                summary.notConfigured > 0
                  ? ("watch" as const)
                  : ("neutral" as const),
            },
          ] as const
        ).map((card) => (
          <button
            key={card.id}
            type="button"
            className="rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
            onClick={() => setStatusFilter(card.id)}
            aria-pressed={statusFilter === card.id}
          >
            <MatrixStatCard
              label={card.label}
              value={card.value}
              status={card.status}
              className={`p-4 ${statusFilter === card.id ? "ring-1 ring-cyan-500/40" : ""}`}
            />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
              statusFilter === f.id
                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                : "border-slate-700 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {f.label}
            {f.id === "OVERDUE" ? ` (${summary.overdue})` : ""}
            {f.id === "DUE" ? ` (${summary.due})` : ""}
            {f.id === "DUE_SOON" ? ` (${summary.dueSoon})` : ""}
            {f.id === "GOOD" ? ` (${summary.good})` : ""}
            {f.id === "NOT_CONFIGURED" ? ` (${summary.notConfigured})` : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MatrixSearchBar
          value={search}
          onValueChange={setSearch}
          placeholder="Search customer, machine, serial, model…"
        />
        <label className="block text-sm text-slate-400">
          Customer
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-400">
          Technician
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-200"
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
          >
            <option value="">All technicians</option>
            {technicians.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      <MatrixCard
        title="Preventive Maintenance Cleaning Counts"
        subtitle="Master impression meter drives PM. Status from Prisma-backed records."
      >
        <div id="pm-table" className="overflow-x-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-400">Loading PM data…</p>
          ) : pageRows.length === 0 ? (
            <MatrixEmptyState
              title="No machines match"
              description="Adjust filters or configure PM intervals for machines that show Not Configured."
            />
          ) : (
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950 text-xs uppercase tracking-wide text-slate-300">
                <tr>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort("customerName")}>
                      Customer
                    </button>
                  </th>
                  <th className="px-3 py-3">Machine</th>
                  <th className="px-3 py-3">Model</th>
                  <th className="px-3 py-3">Serial / Asset</th>
                  <th className="px-3 py-3">Current</th>
                  <th className="px-3 py-3">Last PM</th>
                  <th className="px-3 py-3">Interval</th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort("nextPmDueCount")}>
                      Next due
                    </button>
                  </th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort("countsRemaining")}>
                      Remaining
                    </button>
                  </th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">
                    <button type="button" onClick={() => toggleSort("lastPmAt")}>
                      Last PM date
                    </button>
                  </th>
                  <th className="px-3 py-3">Technician</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    key={row.machineId}
                    className={`border-t border-slate-800/80 ${
                      row.status === "OVERDUE"
                        ? "bg-rose-500/5"
                        : row.status === "DUE"
                          ? "bg-amber-500/5"
                          : ""
                    }`}
                  >
                    <td className="px-3 py-3 text-slate-300">
                      {row.customerName ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/maintenance/machines/${encodeURIComponent(row.machineId)}`}
                        className="font-medium text-cyan-300 hover:underline"
                      >
                        {row.nickname ?? row.machineId}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {row.printerModel ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {row.assetTag ?? row.machineId}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.currentMeterCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.lastPmCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.pmInterval?.toLocaleString() ?? (
                        <span className="text-slate-500">Not configured</span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.nextPmDueCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.countsRemaining?.toLocaleString() ??
                        (row.countsOverdue
                          ? `-${row.countsOverdue.toLocaleString()}`
                          : "—")}
                    </td>
                    <td className="px-3 py-3">
                      <PmCleaningStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {row.lastPmAt
                        ? new Date(row.lastPmAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {row.assignedTechnician ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <MatrixButton
                          href={`/maintenance/machines/${encodeURIComponent(row.machineId)}`}
                          variant="secondary"
                          size="sm"
                        >
                          Details
                        </MatrixButton>
                        {canEditInterval ? (
                          <MatrixButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleConfigureInterval(row)}
                          >
                            Interval
                          </MatrixButton>
                        ) : null}
                        {canComplete ? (
                          <MatrixButton
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={
                              submitting && completeMachineId === row.machineId
                            }
                            onClick={() => void handleComplete(row)}
                          >
                            {submitting && completeMachineId === row.machineId
                              ? "Saving…"
                              : "Complete PM"}
                          </MatrixButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {sorted.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <p>
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
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
        ) : null}
      </MatrixCard>
    </div>
  );
}
