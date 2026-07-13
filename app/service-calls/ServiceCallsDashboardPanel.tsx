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
  MatrixTable,
  type MatrixTableColumn,
} from "../components/ui";
import {
  computeServiceCallMetrics,
  defaultServiceCallFilters,
  filterServiceCalls,
  getServiceCallPriorityBadgeClassName,
  getServiceCallPriorityBadgeVariant,
  getServiceCallPriorityLabel,
  getServiceCallStatusBadgeVariant,
  getServiceCallStatusLabel,
  getServiceCallTypeLabel,
  listServiceCalls,
  sortServiceCalls,
  type ServiceCall,
  type ServiceCallFilterState,
  type ServiceCallPriority,
  type ServiceCallStatus,
  type ServiceCallType,
} from "@/lib/service-calls";
import { SERVICE_CALL_STATUS_ORDER } from "@/lib/service-calls/workflow";

const PRIORITIES: ServiceCallPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
  "EMERGENCY",
];

const TYPES: ServiceCallType[] = [
  "BREAK_FIX",
  "PREVENTIVE_MAINTENANCE",
  "INSTALLATION",
  "NETWORK_SUPPORT",
  "OPERATOR_TRAINING",
  "INSPECTION",
  "REMOTE_SUPPORT",
  "FOLLOW_UP",
  "OTHER",
];

type Row = {
  id: string;
  workOrder: string;
  priority: string;
  status: string;
  customer: string;
  model: string;
  asset: string;
  issue: string;
  technician: string;
  created: string;
  scheduled: string;
  emergency: boolean;
  href: string;
};

export default function ServiceCallsDashboardPanel() {
  const [filters, setFilters] = useState<ServiceCallFilterState>(
    defaultServiceCallFilters(),
  );
  const [calls] = useState<ServiceCall[]>(() => listServiceCalls());

  const metrics = useMemo(() => computeServiceCallMetrics(calls), [calls]);

  const models = useMemo(
    () =>
      Array.from(new Set(calls.map((c) => c.machine.printerModel))).sort(),
    [calls],
  );
  const technicians = useMemo(
    () =>
      Array.from(
        new Set(calls.map((c) => c.assignment.technician).filter(Boolean)),
      ).sort(),
    [calls],
  );
  const organizations = useMemo(
    () =>
      Array.from(
        new Set(calls.map((c) => c.machine.organization).filter(Boolean)),
      ).sort(),
    [calls],
  );

  const visible = useMemo(
    () => sortServiceCalls(filterServiceCalls(calls, filters), filters.sort),
    [calls, filters],
  );

  const rows: Row[] = visible.map((call) => ({
    id: call.id,
    workOrder: call.workOrderNumber,
    priority: call.priority,
    status: call.status,
    customer: `${call.machine.customerName} / ${call.machine.siteName}`,
    model: call.machine.printerModel,
    asset: call.machine.assetTag,
    issue: call.problem.issueTitle,
    technician: call.assignment.technician || "Unassigned",
    created: call.createdAt.slice(0, 10),
    scheduled: (
      call.schedule.scheduledStart || call.schedule.requestedServiceDate
    ).slice(0, 10),
    emergency:
      call.priority === "EMERGENCY" || call.problem.machineCurrentlyDown,
    href: `/service-calls/${call.id}`,
  }));

  const columns: MatrixTableColumn<Row>[] = [
    {
      key: "workOrder",
      header: "Work Order",
      render: (row) => (
        <Link href={row.href} className="font-semibold text-cyan-300 hover:text-cyan-200">
          {row.workOrder}
        </Link>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => (
        <MatrixStatusBadge
          variant={getServiceCallPriorityBadgeVariant(
            row.priority as ServiceCallPriority,
          )}
          label={getServiceCallPriorityLabel(row.priority as ServiceCallPriority)}
          className={getServiceCallPriorityBadgeClassName(
            row.priority as ServiceCallPriority,
          )}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <MatrixStatusBadge
          variant={getServiceCallStatusBadgeVariant(row.status as ServiceCallStatus)}
          label={getServiceCallStatusLabel(row.status as ServiceCallStatus)}
        />
      ),
    },
    { key: "customer", header: "Customer / Site" },
    { key: "model", header: "Model" },
    { key: "asset", header: "Asset" },
    { key: "issue", header: "Issue" },
    { key: "technician", header: "Technician" },
    { key: "created", header: "Created" },
    { key: "scheduled", header: "Scheduled" },
    {
      key: "open",
      header: "",
      render: (row) => (
        <MatrixButton href={row.href} variant="secondary" size="sm">
          Open
        </MatrixButton>
      ),
    },
  ];

  function set<K extends keyof ServiceCallFilterState>(
    key: K,
    value: ServiceCallFilterState[K],
  ) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const selectClass =
    "rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white";

  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <MatrixStatCard label="Open Calls" value={metrics.totalOpen} />
        <MatrixStatCard label="New" value={metrics.newCalls} />
        <MatrixStatCard label="Unassigned" value={metrics.unassigned} />
        <MatrixStatCard label="Assigned" value={metrics.assigned} />
        <MatrixStatCard
          label="Emergency"
          value={metrics.emergency}
          accent={metrics.emergency > 0 ? "text-rose-400" : "text-white"}
        />
        <MatrixStatCard
          label="Waiting Parts"
          value={metrics.waitingForParts}
          accent={
            metrics.waitingForParts > 0 ? "text-amber-400" : "text-white"
          }
        />
        <MatrixStatCard label="Due Today" value={metrics.dueToday} />
        <MatrixStatCard
          label="Overdue"
          value={metrics.overdue}
          accent={metrics.overdue > 0 ? "text-rose-400" : "text-white"}
        />
        <MatrixStatCard label="Closed This Week" value={metrics.closedThisWeek} />
      </div>

      <MatrixCard title="Filters">
        <div className="space-y-4">
          <MatrixSearchBar
            value={filters.search}
            onValueChange={(v) => set("search", v)}
            placeholder="Search WO, ID, asset, serial, customer, site, issue, error…"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Status</span>
              <select
                className={selectClass + " w-full"}
                value={filters.status}
                onChange={(e) =>
                  set("status", e.target.value as ServiceCallFilterState["status"])
                }
              >
                <option value="ALL">All</option>
                {SERVICE_CALL_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {getServiceCallStatusLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Priority</span>
              <select
                className={selectClass + " w-full"}
                value={filters.priority}
                onChange={(e) =>
                  set(
                    "priority",
                    e.target.value as ServiceCallFilterState["priority"],
                  )
                }
              >
                <option value="ALL">All</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {getServiceCallPriorityLabel(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Service Type</span>
              <select
                className={selectClass + " w-full"}
                value={filters.serviceType}
                onChange={(e) =>
                  set(
                    "serviceType",
                    e.target.value as ServiceCallFilterState["serviceType"],
                  )
                }
              >
                <option value="ALL">All</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {getServiceCallTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Model</span>
              <select
                className={selectClass + " w-full"}
                value={filters.printerModel}
                onChange={(e) => set("printerModel", e.target.value)}
              >
                <option value="">All</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Technician</span>
              <select
                className={selectClass + " w-full"}
                value={filters.technician}
                onChange={(e) => set("technician", e.target.value)}
              >
                <option value="">All</option>
                {technicians.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Customer / Site</span>
              <input
                className={selectClass + " w-full"}
                value={filters.customerSite}
                onChange={(e) => set("customerSite", e.target.value)}
                placeholder="Filter customer or site"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Organization</span>
              <select
                className={selectClass + " w-full"}
                value={filters.organization}
                onChange={(e) => set("organization", e.target.value)}
              >
                <option value="">All</option>
                {organizations.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Sort</span>
              <select
                className={selectClass + " w-full"}
                value={filters.sort}
                onChange={(e) =>
                  set("sort", e.target.value as ServiceCallFilterState["sort"])
                }
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="priority">Highest priority</option>
                <option value="scheduled">Scheduled date</option>
                <option value="customer">Customer</option>
                <option value="technician">Technician</option>
                <option value="status">Status</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">From</span>
              <input
                type="date"
                className={selectClass + " w-full"}
                value={filters.dateFrom}
                onChange={(e) => set("dateFrom", e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">To</span>
              <input
                type="date"
                className={selectClass + " w-full"}
                value={filters.dateTo}
                onChange={(e) => set("dateTo", e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["table", "Table"],
                ["card", "Cards"],
                ["board", "Board"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => set("view", mode)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  filters.view === mode
                    ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/40"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
            <MatrixButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setFilters(defaultServiceCallFilters())}
            >
              Reset Filters
            </MatrixButton>
          </div>
        </div>
      </MatrixCard>

      {rows.length === 0 ? (
        <MatrixEmptyState
          title="No service calls match"
          description="Adjust filters or create a new service call."
          actionLabel="New Service Call"
          actionHref="/service-calls/new"
        />
      ) : filters.view === "table" ? (
        <MatrixCard title={`Service Calls (${rows.length})`}>
          <div className="overflow-x-auto">
            <MatrixTable columns={columns} data={rows} rowKey={(r) => r.id} />
          </div>
        </MatrixCard>
      ) : filters.view === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`rounded-xl border p-4 ${
                row.emergency
                  ? "border-rose-500/50 bg-rose-500/10"
                  : "border-slate-800 bg-slate-900/60"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={row.href}
                  className="text-lg font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  {row.workOrder}
                </Link>
                <MatrixStatusBadge
                  variant={getServiceCallPriorityBadgeVariant(
                    row.priority as ServiceCallPriority,
                  )}
                  label={getServiceCallPriorityLabel(
                    row.priority as ServiceCallPriority,
                  )}
                  className={getServiceCallPriorityBadgeClassName(
                    row.priority as ServiceCallPriority,
                  )}
                />
              </div>
              <p className="mt-2 text-sm text-white">{row.issue}</p>
              <p className="mt-1 text-xs text-slate-400">
                {row.customer} · {row.model} · {row.asset}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <MatrixStatusBadge
                  variant={getServiceCallStatusBadgeVariant(
                    row.status as ServiceCallStatus,
                  )}
                  label={getServiceCallStatusLabel(row.status as ServiceCallStatus)}
                />
                <span className="text-xs text-slate-500">{row.technician}</span>
              </div>
              <div className="mt-4">
                <MatrixButton href={row.href} variant="primary" size="md">
                  Open
                </MatrixButton>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <MatrixCard title="Board / Kanban">
          <p className="mb-4 text-sm text-slate-400">
            Board view placeholder — columns mirror open workflow statuses. Full
            drag-and-drop dispatch is a future integration.
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {SERVICE_CALL_STATUS_ORDER.filter(
              (s) => s !== "CLOSED" && s !== "CANCELLED",
            ).map((status) => {
              const column = rows.filter((r) => r.status === status);
              return (
                <div
                  key={status}
                  className="min-w-[220px] flex-1 rounded-lg border border-slate-800 bg-slate-950/80 p-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {getServiceCallStatusLabel(status)} ({column.length})
                  </p>
                  <div className="mt-3 space-y-2">
                    {column.map((row) => (
                      <Link
                        key={row.id}
                        href={row.href}
                        className={`block rounded-lg border p-3 text-sm hover:border-cyan-500/40 ${
                          row.emergency
                            ? "border-rose-500/40 bg-rose-500/10"
                            : "border-slate-800 bg-slate-900"
                        }`}
                      >
                        <p className="font-semibold text-cyan-300">
                          {row.workOrder}
                        </p>
                        <p className="mt-1 text-slate-300 line-clamp-2">
                          {row.issue}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </MatrixCard>
      )}
    </div>
  );
}
