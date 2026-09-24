"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixSearchBar,
  MatrixStatCard,
  MatrixStatusBadge,
} from "../components/ui";
import {
  computeWorkOrderMetrics,
  defaultWorkOrderFilters,
  filterWorkOrders,
  getWorkOrderPriorityLabel,
  getWorkOrderServiceTypeLabel,
  getWorkOrderStatusLabel,
  listWorkOrders,
  priorityBadgeVariant,
  sortWorkOrders,
  statusBadgeVariant,
  type WorkOrderFilterState,
  type WorkOrderPriority,
  type WorkOrderStatus,
  DEFAULT_SERVICE_TYPE_CONFIGS,
  WORK_ORDER_STATUS_ORDER,
} from "@/lib/work-orders";

export default function WorkOrdersDashboardPanel() {
  const [filters, setFilters] = useState<WorkOrderFilterState>(
    defaultWorkOrderFilters("Toby Tompkins"),
  );
  const [tick, setTick] = useState(0);
  const [copying, setCopying] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");

  const orders = useMemo(() => {
    void tick;
    return listWorkOrders();
  }, [tick]);

  const metrics = useMemo(() => computeWorkOrderMetrics(orders), [orders]);

  const visible = useMemo(
    () =>
      sortWorkOrders(
        filterWorkOrders(orders, filters),
        filters.sort,
        filters.sortDir,
      ),
    [orders, filters],
  );

  const customers = useMemo(
    () => Array.from(new Set(orders.map((o) => o.customerName))).sort(),
    [orders],
  );
  const technicians = useMemo(
    () =>
      Array.from(
        new Set(orders.map((o) => o.assignedTechnician).filter(Boolean)),
      ).sort(),
    [orders],
  );
  const regions = useMemo(
    () => Array.from(new Set(orders.map((o) => o.region).filter(Boolean))).sort(),
    [orders],
  );
  const models = useMemo(
    () =>
      Array.from(
        new Set(orders.map((o) => o.printerModel).filter(Boolean) as string[]),
      ).sort(),
    [orders],
  );
  const sites = useMemo(
    () => Array.from(new Set(orders.map((o) => o.siteName))).sort(),
    [orders],
  );

  function patch<K extends keyof WorkOrderFilterState>(
    key: K,
    value: WorkOrderFilterState[K],
  ) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  async function copyQueueToServer() {
    if (copying || orders.length === 0) return;
    const confirmed = window.confirm(
      `Copy ${orders.length} work order(s) to the server? Existing server records will be skipped and browser records will stay unchanged.`,
    );
    if (!confirmed) return;
    setCopying(true);
    setCopyNotice("Copying work orders to the server…");
    try {
      const response = await fetch("/api/work-orders/server-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: "COPY_WORK_ORDERS_TO_SERVER", orders }),
      });
      const body = await response.json() as {
        result?: { inserted: number; skipped: number; rejected: Array<{ workOrderNumber: string; reason: string }> };
        error?: string;
      };
      if (!response.ok || !body.result) throw new Error(body.error ?? "Could not copy work orders.");
      const rejected = body.result.rejected.length ? ` ${body.result.rejected.length} need attention.` : "";
      setCopyNotice(`Server copy complete: ${body.result.inserted} added, ${body.result.skipped} already present.${rejected}`);
    } catch (error) {
      setCopyNotice(error instanceof Error ? error.message : "Could not copy work orders.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MatrixStatCard label="Open Work Orders" value={metrics.open} />
        <MatrixStatCard
          label="Scheduled Today"
          value={metrics.scheduledToday}
          accent="text-cyan-400"
        />
        <MatrixStatCard
          label="Overdue"
          value={metrics.overdue}
          accent="text-rose-400"
        />
        <MatrixStatCard
          label="Waiting for Parts"
          value={metrics.waitingForParts}
          accent="text-amber-300"
        />
        <MatrixStatCard
          label="Completed Today"
          value={metrics.completedToday}
          accent="text-emerald-400"
        />
        <MatrixStatCard
          label="Avg Completion Time"
          value={
            metrics.averageCompletionHours === null
              ? "—"
              : `${metrics.averageCompletionHours}h`
          }
        />
        <MatrixStatCard
          label="Critical Calls"
          value={metrics.critical}
          accent="text-rose-400"
        />
        <MatrixCard title="Refresh">
          <MatrixButton
            variant="secondary"
            size="sm"
            onClick={() => setTick((t) => t + 1)}
          >
            Reload queue
          </MatrixButton>
        </MatrixCard>
      </div>

      <MatrixCard title="Server Work-Order Copy" subtitle="Copies the current browser queue to durable server records. Existing server records are never changed.">
        <div className="flex flex-wrap items-center gap-3">
          <MatrixButton variant="secondary" size="sm" disabled={copying || orders.length === 0} onClick={() => void copyQueueToServer()}>
            {copying ? "Copying…" : `Copy ${orders.length} Work Orders to Server`}
          </MatrixButton>
          <span className="text-xs text-slate-400">Use once before the controlled Field bridge test.</span>
        </div>
        {copyNotice && <p role="status" className="mt-3 text-sm text-cyan-200">{copyNotice}</p>}
      </MatrixCard>

      <MatrixCard
        title="Work Order Queue"
        subtitle="Search and filter the enterprise work order backlog"
      >
        <div className="mb-4 grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <MatrixSearchBar
              value={filters.search}
              onValueChange={(v) => patch("search", v)}
              placeholder="Search WO number, title, customer, tech…"
            />
          </div>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) =>
              patch("status", e.target.value as WorkOrderFilterState["status"])
            }
          >
            <option value="ALL">All statuses</option>
            {WORK_ORDER_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {getWorkOrderStatusLabel(s)}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.priority}
            onChange={(e) =>
              patch(
                "priority",
                e.target.value as WorkOrderFilterState["priority"],
              )
            }
          >
            <option value="ALL">All priorities</option>
            {(["CRITICAL", "HIGH", "NORMAL", "LOW"] as WorkOrderPriority[]).map(
              (p) => (
                <option key={p} value={p}>
                  {getWorkOrderPriorityLabel(p)}
                </option>
              ),
            )}
          </select>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.customer}
            onChange={(e) => patch("customer", e.target.value)}
          >
            <option value="">Customer</option>
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.technician}
            onChange={(e) => patch("technician", e.target.value)}
          >
            <option value="">Technician</option>
            {technicians.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.serviceType}
            onChange={(e) => patch("serviceType", e.target.value)}
          >
            <option value="">Service Type</option>
            {DEFAULT_SERVICE_TYPE_CONFIGS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.region}
            onChange={(e) => patch("region", e.target.value)}
          >
            <option value="">Region</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.printerModel}
            onChange={(e) => patch("printerModel", e.target.value)}
          >
            <option value="">Printer Model</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={filters.site}
            onChange={(e) => patch("site", e.target.value)}
          >
            <option value="">Site</option>
            {sites.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <input
            type="date"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={filters.dateFrom}
            onChange={(e) => patch("dateFrom", e.target.value)}
          />
          <input
            type="date"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={filters.dateTo}
            onChange={(e) => patch("dateTo", e.target.value)}
          />
          <label className="inline-flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={filters.onlyMine}
              onChange={(e) => patch("onlyMine", e.target.checked)}
            />
            Only my assigned
          </label>
        </div>

        {visible.length === 0 ? (
          <MatrixEmptyState
            title="No work orders match"
            description="Adjust filters or create a new work order."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-3">WO #</th>
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Customer / Site</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Priority</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Technician</th>
                  <th className="px-3 py-3">Scheduled</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((wo) => (
                  <tr
                    key={wo.id}
                    className="border-b border-slate-800/80 hover:bg-slate-950/50"
                  >
                    <td className="px-3 py-3">
                      <Link
                        href={`/work-orders/${wo.id}`}
                        className="font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        {wo.workOrderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{wo.title}</td>
                    <td className="px-3 py-3">
                      {wo.customerName}
                      <span className="block text-xs text-slate-500">
                        {wo.siteName}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {getWorkOrderServiceTypeLabel(wo.serviceType)}
                    </td>
                    <td className="px-3 py-3">
                      <MatrixStatusBadge
                        variant={priorityBadgeVariant(wo.priority)}
                        label={getWorkOrderPriorityLabel(wo.priority)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <MatrixStatusBadge
                        variant={statusBadgeVariant(wo.status as WorkOrderStatus)}
                        label={getWorkOrderStatusLabel(wo.status)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      {wo.assignedTechnician || "Unassigned"}
                    </td>
                    <td className="px-3 py-3">
                      {(wo.scheduledStart ?? "—").slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MatrixCard>
    </div>
  );
}
