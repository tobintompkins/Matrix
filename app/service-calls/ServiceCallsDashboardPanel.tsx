"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EnterpriseTableToolbar,
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatCard,
  MatrixStatusBadge,
  MatrixTable,
  exportRowsAsCsv,
  useColumnVisibility,
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

const COLUMN_OPTIONS = [
  { key: "workOrder", label: "Work Order", locked: true },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status", locked: true },
  { key: "customer", label: "Customer / Site" },
  { key: "model", label: "Model" },
  { key: "asset", label: "Asset" },
  { key: "issue", label: "Issue" },
  { key: "technician", label: "Technician" },
  { key: "created", label: "Created" },
  { key: "scheduled", label: "Scheduled" },
  { key: "open", label: "Open", locked: true },
];

export default function ServiceCallsDashboardPanel() {
  const [filters, setFilters] = useState<ServiceCallFilterState>(
    defaultServiceCallFilters(),
  );
  const [calls] = useState<ServiceCall[]>(() => listServiceCalls());
  const columnsVisibility = useColumnVisibility(
    "service-calls",
    COLUMN_OPTIONS,
  );

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
      ).sort() as string[],
    [calls],
  );
  const organizations = useMemo(
    () =>
      Array.from(
        new Set(calls.map((c) => c.machine.organization).filter(Boolean)),
      ).sort() as string[],
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
      sortable: true,
      render: (row) => (
        <Link
          href={row.href}
          className="font-semibold text-cyan-300 hover:text-cyan-200"
        >
          {row.workOrder}
        </Link>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
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
      sortable: true,
      render: (row) => (
        <MatrixStatusBadge
          variant={getServiceCallStatusBadgeVariant(
            row.status as ServiceCallStatus,
          )}
          label={getServiceCallStatusLabel(row.status as ServiceCallStatus)}
        />
      ),
    },
    { key: "customer", header: "Customer / Site", sortable: true },
    { key: "model", header: "Model", sortable: true },
    { key: "asset", header: "Asset", sortable: true },
    { key: "issue", header: "Issue", sortable: true },
    { key: "technician", header: "Technician", sortable: true },
    { key: "created", header: "Created", sortable: true },
    { key: "scheduled", header: "Scheduled", sortable: true },
    {
      key: "open",
      header: "Action",
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

  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (filters.search.trim()) labels.push(`Search: ${filters.search.trim()}`);
    if (filters.status !== "ALL") {
      labels.push(
        `Status: ${getServiceCallStatusLabel(filters.status as ServiceCallStatus)}`,
      );
    }
    if (filters.priority !== "ALL") {
      labels.push(
        `Priority: ${getServiceCallPriorityLabel(filters.priority as ServiceCallPriority)}`,
      );
    }
    if (filters.serviceType !== "ALL") {
      labels.push(
        `Type: ${getServiceCallTypeLabel(filters.serviceType as ServiceCallType)}`,
      );
    }
    if (filters.printerModel) labels.push(`Model: ${filters.printerModel}`);
    if (filters.technician) labels.push(`Tech: ${filters.technician}`);
    if (filters.customerSite.trim()) {
      labels.push(`Customer: ${filters.customerSite.trim()}`);
    }
    if (filters.organization) labels.push(`Org: ${filters.organization}`);
    if (filters.dateFrom) labels.push(`From: ${filters.dateFrom}`);
    if (filters.dateTo) labels.push(`To: ${filters.dateTo}`);
    return labels;
  }, [filters]);

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
          accent={metrics.emergency > 0 ? "text-rose-400" : undefined}
        />
        <MatrixStatCard
          label="Waiting Parts"
          value={metrics.waitingForParts}
          accent={metrics.waitingForParts > 0 ? "text-amber-400" : undefined}
        />
        <MatrixStatCard label="Due Today" value={metrics.dueToday} />
        <MatrixStatCard
          label="Overdue"
          value={metrics.overdue}
          accent={metrics.overdue > 0 ? "text-rose-400" : undefined}
        />
        <MatrixStatCard label="Closed This Week" value={metrics.closedThisWeek} />
      </div>

      <EnterpriseTableToolbar
        searchPlaceholder="Search service calls"
        searchValue={filters.search}
        onSearchChange={(value) => set("search", value)}
        resultCount={rows.length}
        resultLabel="service calls"
        activeFilterLabels={activeFilterLabels}
        onClearFilters={() => setFilters(defaultServiceCallFilters())}
        onExport={() =>
          exportRowsAsCsv("service-calls-filtered", rows, [
            { key: "workOrder", header: "Work Order", value: (r) => r.workOrder },
            { key: "priority", header: "Priority", value: (r) => r.priority },
            { key: "status", header: "Status", value: (r) => r.status },
            { key: "customer", header: "Customer", value: (r) => r.customer },
            { key: "model", header: "Model", value: (r) => r.model },
            { key: "asset", header: "Asset", value: (r) => r.asset },
            { key: "issue", header: "Issue", value: (r) => r.issue },
            {
              key: "technician",
              header: "Technician",
              value: (r) => r.technician,
            },
            { key: "created", header: "Created", value: (r) => r.created },
            { key: "scheduled", header: "Scheduled", value: (r) => r.scheduled },
          ])
        }
        exportLabel="Export CSV (filtered results)"
        columnOptions={COLUMN_OPTIONS}
        visibleColumnKeys={columnsVisibility.visibleKeys}
        onToggleColumn={columnsVisibility.toggle}
        selectFilters={[
          {
            id: "status",
            label: "Status",
            value: filters.status === "ALL" ? "" : filters.status,
            allLabel: "All statuses",
            onChange: (value) =>
              set("status", (value || "ALL") as ServiceCallFilterState["status"]),
            options: SERVICE_CALL_STATUS_ORDER.map((s) => ({
              value: s,
              label: getServiceCallStatusLabel(s),
            })),
          },
          {
            id: "priority",
            label: "Priority",
            value: filters.priority === "ALL" ? "" : filters.priority,
            allLabel: "All priorities",
            onChange: (value) =>
              set(
                "priority",
                (value || "ALL") as ServiceCallFilterState["priority"],
              ),
            options: PRIORITIES.map((p) => ({
              value: p,
              label: getServiceCallPriorityLabel(p),
            })),
          },
          {
            id: "serviceType",
            label: "Job type",
            value: filters.serviceType === "ALL" ? "" : filters.serviceType,
            allLabel: "All types",
            onChange: (value) =>
              set(
                "serviceType",
                (value || "ALL") as ServiceCallFilterState["serviceType"],
              ),
            options: TYPES.map((t) => ({
              value: t,
              label: getServiceCallTypeLabel(t),
            })),
          },
          {
            id: "model",
            label: "Model",
            value: filters.printerModel,
            allLabel: "All models",
            onChange: (value) => set("printerModel", value),
            options: models.map((m) => ({ value: m, label: m })),
          },
          {
            id: "technician",
            label: "Technician",
            value: filters.technician,
            allLabel: "All technicians",
            onChange: (value) => set("technician", value),
            options: technicians.map((t) => ({ value: t, label: t })),
          },
          {
            id: "organization",
            label: "Organization",
            value: filters.organization,
            allLabel: "All organizations",
            onChange: (value) => set("organization", value),
            options: organizations.map((o) => ({ value: o, label: o })),
          },
          {
            id: "sort",
            label: "Sort",
            value: filters.sort,
            onChange: (value) =>
              set("sort", value as ServiceCallFilterState["sort"]),
            options: [
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "priority", label: "Highest priority" },
              { value: "scheduled", label: "Scheduled date" },
              { value: "customer", label: "Customer" },
              { value: "technician", label: "Technician" },
              { value: "status", label: "Status" },
            ],
          },
        ]}
        textFilters={[
          {
            id: "customerSite",
            label: "Customer / Site",
            value: filters.customerSite,
            onChange: (value) => set("customerSite", value),
            placeholder: "Filter customer or site",
          },
          {
            id: "dateFrom",
            label: "From",
            value: filters.dateFrom,
            onChange: (value) => set("dateFrom", value),
            type: "date",
          },
          {
            id: "dateTo",
            label: "To",
            value: filters.dateTo,
            onChange: (value) => set("dateTo", value),
            type: "date",
          },
        ]}
        secondaryFilters={
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
                className={`rounded-lg px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                  filters.view === mode
                    ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/40"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {rows.length === 0 ? (
        <MatrixEmptyState
          title={
            activeFilterLabels.length > 0
              ? "No service calls match these filters"
              : "No service calls found"
          }
          description={
            activeFilterLabels.length > 0
              ? "Clear filters to view more results, or create a new service call."
              : "Create a new service call to get started."
          }
          actionLabel={
            activeFilterLabels.length > 0 ? "Clear filters" : "New Service Call"
          }
          actionHref={
            activeFilterLabels.length > 0 ? undefined : "/service-calls/new"
          }
          onAction={
            activeFilterLabels.length > 0
              ? () => setFilters(defaultServiceCallFilters())
              : undefined
          }
        />
      ) : filters.view === "table" ? (
        <MatrixCard title={`Service Calls (${rows.length})`}>
          <MatrixTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            searchable={false}
            paginated
            pageSize={25}
            pageSizeOptions={[10, 25, 50, 100]}
            visibleColumnKeys={columnsVisibility.visibleKeys}
            stickyHeader
            compact
            emptyTitle="No service calls match these filters"
            emptyDescription="Clear filters to view more results."
          />
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
                  label={getServiceCallStatusLabel(
                    row.status as ServiceCallStatus,
                  )}
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
                        <p className="mt-1 line-clamp-2 text-slate-300">
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
