"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixSearchBar,
  MatrixStatCard,
  MatrixStatusBadge,
  type MatrixStatusVariant,
} from "../components/ui";
import CompleteMaintenanceDialog from "../components/maintenance/CompleteMaintenanceDialog";
import CopyCountEntryDialog from "../components/maintenance/CopyCountEntryDialog";
import CustomerMaintenanceSummaryCard from "../components/maintenance/CustomerMaintenanceSummaryCard";
import MaintenanceCalendarPanel from "../components/maintenance/MaintenanceCalendarPanel";
import MaintenanceChartsPanel from "../components/maintenance/MaintenanceChartsPanel";
import MaintenanceExportPanel from "../components/maintenance/MaintenanceExportPanel";
import MaintenanceFleetMap from "../components/maintenance/MaintenanceFleetMap";
import MaintenancePlanningDrawer from "../components/maintenance/MaintenancePlanningDrawer";
import MonthlyPlanningPanel from "../components/maintenance/MonthlyPlanningPanel";
import SmartMaintenanceAssistPanel from "../components/maintenance/SmartMaintenanceAssistPanel";
import TechnicianDashboardPanel from "../components/maintenance/TechnicianDashboardPanel";
import {
  buildCustomerMaintenanceSummary,
  buildDashboardCharts,
  buildMaintenanceQueueRows,
  buildMonthlyPlanning,
  buildTechnicianDashboard,
  completeMaintenance,
  computeFleetDashboardMetrics,
  defaultMaintenanceDashboardFilters,
  filterMaintenanceQueue,
  formatCopyCount,
  formatMaintenanceDate,
  getMaintenanceStatusLabel,
  listAllMaintenanceCompletions,
  listMaintenanceProfiles,
  listMaintenanceSchedules,
  paginateRows,
  recordCopyCount,
  recordMaintenanceAudit,
  sortMaintenanceQueue,
  type MaintenanceDashboardFilters,
  type MaintenanceKind,
  type MaintenanceQueueRow,
  type MaintenanceScheduleEvent,
  type MaintenanceStatus,
  type PlanningWindow,
} from "@/lib/maintenance";
import {
  notifyCopyCountUpdated,
  notifyMaintenanceCompleted,
} from "@/lib/notifications";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { hasMatrixPermission } from "@/lib/auth/permissions";

type TabId =
  | "overview"
  | "queue"
  | "insights"
  | "calendar"
  | "map"
  | "charts"
  | "technician"
  | "export";

function statusVariant(status: MaintenanceStatus): MatrixStatusVariant {
  switch (status) {
    case "CURRENT":
      return "completed";
    case "DUE_SOON":
      return "warning";
    case "DUE":
      return "warning";
    case "OVERDUE":
      return "error";
    default:
      return "offline";
  }
}

function healthAccent(label: string): string {
  if (label === "Excellent") return "text-emerald-400";
  if (label === "Good") return "text-cyan-400";
  if (label === "Needs Attention") return "text-amber-400";
  return "text-rose-400";
}

export default function FleetMaintenanceDashboard() {
  const canSchedule = hasMatrixPermission(DEV_FALLBACK_ROLE, "SCHEDULE_MAINTENANCE");
  const canExport = hasMatrixPermission(DEV_FALLBACK_ROLE, "EXPORT_MAINTENANCE");
  const canComplete = hasMatrixPermission(DEV_FALLBACK_ROLE, "COMPLETE_MAINTENANCE");
  const canEnterCount = hasMatrixPermission(DEV_FALLBACK_ROLE, "ENTER_COPY_COUNT");

  const [tab, setTab] = useState<TabId>("overview");
  const [filters, setFilters] = useState<MaintenanceDashboardFilters>(
    defaultMaintenanceDashboardFilters("Toby Tompkins"),
  );
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRow, setSelectedRow] = useState<MaintenanceQueueRow | null>(
    null,
  );
  const [planningWindow, setPlanningWindow] =
    useState<PlanningWindow>("THIS_WEEK");
  const [schedules, setSchedules] = useState<MaintenanceScheduleEvent[]>(() =>
    listMaintenanceSchedules(),
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [copyDialogPrinter, setCopyDialogPrinter] = useState<string | null>(
    null,
  );
  const [completeDialog, setCompleteDialog] = useState<{
    printerId: string;
    kind: MaintenanceKind;
  } | null>(null);
  const [, startTransition] = useTransition();

  const profiles = useMemo(() => {
    void refreshKey;
    return listMaintenanceProfiles();
  }, [refreshKey]);

  const completions = useMemo(() => {
    void refreshKey;
    return listAllMaintenanceCompletions();
  }, [refreshKey]);

  const metrics = useMemo(
    () => computeFleetDashboardMetrics(profiles, completions),
    [profiles, completions],
  );

  const allRows = useMemo(
    () => buildMaintenanceQueueRows(profiles),
    [profiles],
  );

  const filtered = useMemo(
    () =>
      sortMaintenanceQueue(
        filterMaintenanceQueue(allRows, filters),
        filters.sort,
        filters.sortDir,
      ),
    [allRows, filters],
  );

  const paged = useMemo(
    () => paginateRows(filtered, page, 10),
    [filtered, page],
  );

  const charts = useMemo(
    () => buildDashboardCharts(profiles, completions),
    [profiles, completions],
  );

  const planning = useMemo(
    () => buildMonthlyPlanning(profiles, planningWindow),
    [profiles, planningWindow],
  );

  const technicianData = useMemo(
    () =>
      buildTechnicianDashboard(
        filters.currentUserTechnician || "Toby Tompkins",
        allRows,
        completions,
      ),
    [allRows, completions, filters.currentUserTechnician],
  );

  const customerSummary = useMemo(() => {
    const name = allRows[0]?.customerName ?? "SFX / MPX";
    return buildCustomerMaintenanceSummary(name, profiles, completions);
  }, [allRows, profiles, completions]);

  const customers = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.customerName))).sort(),
    [allRows],
  );
  const sites = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.siteName))).sort(),
    [allRows],
  );
  const models = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.model))).sort(),
    [allRows],
  );
  const technicians = useMemo(
    () =>
      Array.from(new Set(allRows.map((r) => r.assignedTechnician))).sort(),
    [allRows],
  );
  const regions = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.region))).sort(),
    [allRows],
  );
  const serviceAreas = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.serviceArea))).sort(),
    [allRows],
  );

  function refresh() {
    startTransition(() => {
      setRefreshKey((k) => k + 1);
      setSchedules(listMaintenanceSchedules());
    });
  }

  function patchFilter<K extends keyof MaintenanceDashboardFilters>(
    key: K,
    value: MaintenanceDashboardFilters[K],
  ) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "queue", label: "Queue" },
    { id: "insights", label: "Smart Assist" },
    { id: "calendar", label: "Calendar" },
    { id: "map", label: "Fleet Map" },
    { id: "charts", label: "Charts" },
    { id: "technician", label: "Technician" },
    { id: "export", label: "Export" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              recordMaintenanceAudit({
                action: "DASHBOARD_ACTION",
                actor: filters.currentUserTechnician || "Matrix User",
                details: `Opened ${t.label} tab`,
              });
            }}
            className={
              tab === t.id
                ? "rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
                : "rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "overview" || tab === "queue") && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            <MatrixStatCard label="Total Printers" value={metrics.totalPrinters} />
            <MatrixStatCard
              label="Current"
              value={metrics.printersCurrent}
              accent="text-emerald-400"
            />
            <MatrixStatCard
              label="Due Soon"
              value={metrics.printersDueSoon}
              accent="text-amber-300"
            />
            <MatrixStatCard
              label="Due"
              value={metrics.printersDue}
              accent="text-orange-400"
            />
            <MatrixStatCard
              label="Overdue"
              value={metrics.printersOverdue}
              accent="text-rose-400"
            />
            <MatrixStatCard
              label="Setup Required"
              value={metrics.printersSetupRequired}
              accent="text-slate-300"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MatrixStatCard
              label="Total Fleet Copies"
              value={
                metrics.totalFleetCopies === null
                  ? "Insufficient data"
                  : formatCopyCount(metrics.totalFleetCopies)
              }
            />
            <MatrixStatCard
              label="Average Fleet Copy Count"
              value={
                metrics.averageFleetCount === null
                  ? "Insufficient data"
                  : formatCopyCount(metrics.averageFleetCount)
              }
            />
            <MatrixStatCard
              label="Average Monthly Volume"
              value={
                metrics.averageMonthlyVolume === null
                  ? "Insufficient data"
                  : formatCopyCount(metrics.averageMonthlyVolume)
              }
            />
            <MatrixStatCard
              label="PMs Completed This Month"
              value={metrics.pmsCompletedThisMonth}
              accent="text-cyan-400"
            />
            <MatrixStatCard
              label="Cleanings This Month"
              value={metrics.cleaningsCompletedThisMonth}
            />
            <MatrixStatCard
              label="Joint Units Completed"
              value={metrics.jointUnitsCompletedThisMonth}
            />
            <MatrixStatCard
              label="DTF PMs Completed"
              value={metrics.dtfPmsCompletedThisMonth}
            />
            <MatrixCard title="Fleet Health" className="sm:col-span-1">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p
                    className={`text-5xl font-bold ${healthAccent(metrics.health.label)}`}
                  >
                    {metrics.health.insufficientData
                      ? "—"
                      : `${metrics.health.percentage}%`}
                  </p>
                  <p className="mt-2 text-lg text-slate-200">
                    {metrics.health.insufficientData
                      ? "Insufficient data"
                      : metrics.health.label}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Current ÷ configured printers (excludes setup required)
                  </p>
                </div>
                <div
                  className="h-24 w-24 rounded-full border-8 border-slate-800"
                  style={{
                    background: `conic-gradient(${
                      metrics.health.insufficientData
                        ? "#334155"
                        : metrics.health.percentage >= 85
                          ? "#22d3ee"
                          : metrics.health.percentage >= 70
                            ? "#fbbf24"
                            : "#fb7185"
                    } ${metrics.health.percentage}%, #1e293b 0)`,
                  }}
                  aria-hidden
                />
              </div>
            </MatrixCard>
          </div>
        </>
      )}

      {tab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <MonthlyPlanningPanel
            window={planningWindow}
            onWindowChange={setPlanningWindow}
            items={planning}
            onSelect={(printerId) => {
              const row = allRows.find((r) => r.printerId === printerId);
              if (row) setSelectedRow(row);
            }}
          />
          <CustomerMaintenanceSummaryCard summary={customerSummary} />
        </div>
      )}

      {(tab === "overview" || tab === "queue") && (
        <MatrixCard
          title="Maintenance Queue"
          subtitle="Priority order: Overdue → Due → Due Soon → Setup Required → Current"
        >
          <div className="mb-4 grid gap-3 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <MatrixSearchBar
                value={filters.search}
                onValueChange={(v) => patchFilter("search", v)}
                placeholder="Search customer, site, printer, tech…"
              />
            </div>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={filters.status}
              onChange={(e) =>
                patchFilter(
                  "status",
                  e.target.value as MaintenanceDashboardFilters["status"],
                )
              }
            >
              <option value="ALL">All statuses</option>
              <option value="OVERDUE">Overdue</option>
              <option value="DUE">Due</option>
              <option value="DUE_SOON">Due Soon</option>
              <option value="UNKNOWN">Setup Required</option>
              <option value="CURRENT">Current</option>
            </select>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={filters.sort}
              onChange={(e) =>
                patchFilter(
                  "sort",
                  e.target.value as MaintenanceDashboardFilters["sort"],
                )
              }
            >
              <option value="priority">Sort: Priority</option>
              <option value="customer">Sort: Customer</option>
              <option value="site">Sort: Site</option>
              <option value="printer">Sort: Printer</option>
              <option value="model">Sort: Model</option>
              <option value="currentCount">Sort: Current Count</option>
              <option value="nextPm">Sort: Next PM</option>
              <option value="copiesRemaining">Sort: Copies Remaining</option>
              <option value="technician">Sort: Technician</option>
              <option value="lastPm">Sort: Last PM</option>
            </select>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={filters.customer}
              onChange={(e) => patchFilter("customer", e.target.value)}
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
              value={filters.site}
              onChange={(e) => patchFilter("site", e.target.value)}
            >
              <option value="">Site</option>
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={filters.model}
              onChange={(e) => patchFilter("model", e.target.value)}
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
              value={filters.technician}
              onChange={(e) => patchFilter("technician", e.target.value)}
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
              value={filters.region}
              onChange={(e) => patchFilter("region", e.target.value)}
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
              value={filters.serviceArea}
              onChange={(e) => patchFilter("serviceArea", e.target.value)}
            >
              <option value="">Service Area</option>
              {serviceAreas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={filters.customerPriority}
              onChange={(e) =>
                patchFilter(
                  "customerPriority",
                  e.target.value as MaintenanceDashboardFilters["customerPriority"],
                )
              }
            >
              <option value="ALL">Customer Priority</option>
              <option value="STANDARD">Standard</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.onlyMyAssigned}
                onChange={(e) => patchFilter("onlyMyAssigned", e.target.checked)}
              />
              Only My Assigned Printers
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.pmType}
                onChange={(e) => patchFilter("pmType", e.target.checked)}
              />
              PM attention
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.cleaningType}
                onChange={(e) => patchFilter("cleaningType", e.target.checked)}
              />
              Cleaning
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.jointUnit}
                onChange={(e) => patchFilter("jointUnit", e.target.checked)}
              />
              Joint Unit
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.dtf}
                onChange={(e) => patchFilter("dtf", e.target.checked)}
              />
              DTF
            </label>
            <input
              type="number"
              min={0}
              placeholder="Min copies"
              className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={filters.copyCountMin}
              onChange={(e) => patchFilter("copyCountMin", e.target.value)}
            />
            <input
              type="number"
              min={0}
              placeholder="Max copies"
              className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={filters.copyCountMax}
              onChange={(e) => patchFilter("copyCountMax", e.target.value)}
            />
          </div>

          {paged.items.length === 0 ? (
            <MatrixEmptyState
              title="No printers match"
              description="Adjust filters to see the maintenance queue."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-3">Sel</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Site</th>
                    <th className="px-3 py-3">Printer</th>
                    <th className="px-3 py-3">Model</th>
                    <th className="px-3 py-3">Current Count</th>
                    <th className="px-3 py-3">Next PM</th>
                    <th className="px-3 py-3">Copies Remaining</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Assigned Technician</th>
                    <th className="px-3 py-3">Last PM</th>
                    <th className="px-3 py-3">Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((row) => (
                    <tr
                      key={row.printerId}
                      className="border-b border-slate-800/80 hover:bg-slate-950/60"
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.printerId)}
                          onChange={() => toggleSelected(row.printerId)}
                          aria-label={`Select ${row.printerName}`}
                        />
                      </td>
                      <td className="px-3 py-3">{row.customerName}</td>
                      <td className="px-3 py-3">{row.siteName}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="font-semibold text-cyan-300 hover:text-cyan-200"
                          onClick={() => setSelectedRow(row)}
                        >
                          {row.printerName}
                        </button>
                      </td>
                      <td className="px-3 py-3">{row.model}</td>
                      <td className="px-3 py-3">
                        {formatCopyCount(row.currentCount)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCopyCount(row.nextPmDueCount)}
                      </td>
                      <td className="px-3 py-3">
                        {formatCopyCount(row.copiesRemaining)}
                      </td>
                      <td className="px-3 py-3">
                        <MatrixStatusBadge
                          variant={statusVariant(row.status)}
                          label={getMaintenanceStatusLabel(row.status)}
                        />
                      </td>
                      <td className="px-3 py-3">{row.assignedTechnician}</td>
                      <td className="px-3 py-3">
                        {formatMaintenanceDate(row.lastPmDate)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {canEnterCount && (
                            <button
                              type="button"
                              className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                              onClick={() => setCopyDialogPrinter(row.printerId)}
                            >
                              Count
                            </button>
                          )}
                          {canComplete && (
                            <>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                                onClick={() =>
                                  setCompleteDialog({
                                    printerId: row.printerId,
                                    kind: "PM",
                                  })
                                }
                              >
                                PM
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                                onClick={() =>
                                  setCompleteDialog({
                                    printerId: row.printerId,
                                    kind: "CLEANING",
                                  })
                                }
                              >
                                Clean
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                            onClick={() => setSelectedRow(row)}
                          >
                            Plan
                          </button>
                          <Link
                            href={`/digital-twin/${row.printerId}`}
                            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                          >
                            Open
                          </Link>
                          <Link
                            href={`/parts-order-builder?assetId=${encodeURIComponent(row.assetTag)}`}
                            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                          >
                            Parts
                          </Link>
                          <Link
                            href={`/service-calls/new?machineId=${encodeURIComponent(row.printerId)}`}
                            className="rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800"
                          >
                            Ticket
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
            <p>
              Showing {paged.items.length} of {paged.total} (page {paged.page}/
              {paged.pages}) — lazy-paginated queue
            </p>
            <div className="flex gap-2">
              <MatrixButton
                variant="secondary"
                size="sm"
                disabled={paged.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </MatrixButton>
              <MatrixButton
                variant="secondary"
                size="sm"
                disabled={paged.page >= paged.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </MatrixButton>
            </div>
          </div>
        </MatrixCard>
      )}

      {tab === "insights" && <SmartMaintenanceAssistPanel />}

      {tab === "calendar" && (
        <MaintenanceCalendarPanel
          events={schedules}
          canSchedule={canSchedule}
          technicians={technicians}
          queue={allRows}
          onChanged={() => {
            setSchedules(listMaintenanceSchedules());
            refresh();
          }}
        />
      )}

      {tab === "map" && (
        <MaintenanceFleetMap
          rows={filtered}
          onSelect={(row) => setSelectedRow(row)}
        />
      )}

      {tab === "charts" && <MaintenanceChartsPanel charts={charts} />}

      {tab === "technician" && (
        <TechnicianDashboardPanel data={technicianData} />
      )}

      {tab === "export" && (
        <MaintenanceExportPanel
          rows={filtered}
          selectedIds={selectedIds}
          customers={customers}
          canExport={canExport}
          exportedBy={filters.currentUserTechnician || "Matrix User"}
        />
      )}

      {selectedRow && (
        <MaintenancePlanningDrawer
          row={selectedRow}
          canSchedule={canSchedule}
          canComplete={canComplete}
          onClose={() => setSelectedRow(null)}
          onComplete={(kind) => {
            setCompleteDialog({ printerId: selectedRow.printerId, kind });
          }}
          onEnterCount={() => setCopyDialogPrinter(selectedRow.printerId)}
          onScheduled={() => {
            setSchedules(listMaintenanceSchedules());
            refresh();
          }}
        />
      )}

      {copyDialogPrinter &&
        (() => {
          const profile = profiles.find(
            (p) => p.printerId === copyDialogPrinter,
          );
          if (!profile) return null;
          return (
            <CopyCountEntryDialog
              key={copyDialogPrinter}
              open
              currentCopyCount={profile.currentCopyCount}
              previousCopyCount={profile.currentCopyCount}
              onClose={() => setCopyDialogPrinter(null)}
              onSave={({ copyCount, notes, lowerCountReason }) => {
                const result = recordCopyCount({
                  printerId: profile.printerId,
                  copyCount,
                  notes,
                  enteredBy: filters.currentUserTechnician || "Matrix User",
                  lowerCountReason,
                });
                if (!result.ok) return;
                notifyCopyCountUpdated({
                  printerId: profile.printerId,
                  printerName: profile.nickname || profile.assetTag,
                  customerName: profile.customerName,
                  copyCount,
                  enteredBy: filters.currentUserTechnician || "Matrix User",
                });
                setCopyDialogPrinter(null);
                refresh();
              }}
            />
          );
        })()}

      {completeDialog &&
        (() => {
          const profile = profiles.find(
            (p) => p.printerId === completeDialog.printerId,
          );
          if (!profile) return null;
          return (
            <CompleteMaintenanceDialog
              key={`${completeDialog.printerId}-${completeDialog.kind}`}
              open
              printerName={`${profile.nickname} (${profile.assetTag})`}
              defaultCopyCount={profile.currentCopyCount}
              initialKind={completeDialog.kind}
              onClose={() => setCompleteDialog(null)}
              onSave={(input) => {
                const result = completeMaintenance({
                  printerId: profile.printerId,
                  ...input,
                });
                if (!result.ok) return;
                notifyMaintenanceCompleted({
                  printerId: profile.printerId,
                  printerName: profile.nickname || profile.assetTag,
                  customerName: profile.customerName,
                  kind: input.kind,
                  technician: input.technician,
                });
                setCompleteDialog(null);
                refresh();
              }}
            />
          );
        })()}
    </div>
  );
}
