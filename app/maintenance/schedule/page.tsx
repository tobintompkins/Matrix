"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  EnterpriseTableToolbar,
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixPageHeader,
  MatrixTable,
  exportRowsAsCsv,
  useColumnVisibility,
  type MatrixTableColumn,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import PMStatusBadge from "../components/PMStatusBadge";
import PMPartsKitCard from "../components/PMPartsKitCard";
import {
  createPmSchedule,
  getPmPartsKit,
  listIntervalRules,
  listPmScheduleRows,
  listProfiles,
  listSiteVisitPlan,
  startPmCompletion,
  updatePmCompletionSession,
  finalizePmCompletion,
  type PmScheduleRow,
} from "@/lib/pm-intelligence";

type ScheduleTableRow = {
  id: string;
  scheduledDate: string;
  customerName: string;
  machineName: string;
  assignedTechnician: string;
  partsAvailability: string;
  estimatedLaborHours: string;
  status: string;
  printerModel: string;
  priority: string;
};

const COLUMN_OPTIONS = [
  { key: "scheduledDate", label: "Date", locked: true },
  { key: "customerName", label: "Customer" },
  { key: "machineName", label: "Machine", locked: true },
  { key: "assignedTechnician", label: "Technician" },
  { key: "partsAvailability", label: "Parts" },
  { key: "estimatedLaborHours", label: "Labor" },
  { key: "status", label: "Status", locked: true },
];

export default function PmSchedulePage() {
  const profiles = useMemo(() => listProfiles(), []);
  const [rows, setRows] = useState(() => listPmScheduleRows());
  const [printerId, setPrinterId] = useState(profiles[0]?.printerId ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tech, setTech] = useState("Alex Rivera");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [site, setSite] = useState(profiles[0]?.siteName ?? "");
  const [wizardId, setWizardId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [techFilter, setTechFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const columnsVisibility = useColumnVisibility("pm-schedule", COLUMN_OPTIONS);

  const sites = [...new Set(profiles.map((p) => p.siteName))];
  const plan = useMemo(() => listSiteVisitPlan(site), [site]);
  const kitId = listIntervalRules().find(
    (r) =>
      r.printerModel ===
      profiles.find((p) => p.printerId === printerId)?.printerModel,
  )?.requiredPartsKitId;
  const kit = kitId ? getPmPartsKit(kitId) : null;

  const tableRows: ScheduleTableRow[] = useMemo(
    () =>
      rows.map((r: PmScheduleRow) => ({
        id: r.id,
        scheduledDate: r.scheduledDate,
        customerName: r.customerName,
        machineName: r.machineName,
        assignedTechnician: r.assignedTechnician ?? "—",
        partsAvailability: r.partsAvailability,
        estimatedLaborHours: `${r.estimatedLaborHours}h`,
        status: r.status,
        printerModel: r.printerModel,
        priority: r.priority,
      })),
    [rows],
  );

  const statuses = useMemo(
    () => Array.from(new Set(tableRows.map((r) => r.status))).sort(),
    [tableRows],
  );
  const technicians = useMemo(
    () =>
      Array.from(
        new Set(
          tableRows
            .map((r) => r.assignedTechnician)
            .filter((t) => t && t !== "—"),
        ),
      ).sort(),
    [tableRows],
  );
  const models = useMemo(
    () => Array.from(new Set(tableRows.map((r) => r.printerModel))).sort(),
    [tableRows],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tableRows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (techFilter && row.assignedTechnician !== techFilter) return false;
      if (modelFilter && row.printerModel !== modelFilter) return false;
      if (
        overdueOnly &&
        !String(row.status).toLowerCase().includes("overdue")
      ) {
        return false;
      }
      if (!q) return true;
      return (
        row.customerName.toLowerCase().includes(q) ||
        row.machineName.toLowerCase().includes(q) ||
        row.assignedTechnician.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q) ||
        row.printerModel.toLowerCase().includes(q)
      );
    });
  }, [tableRows, search, statusFilter, techFilter, modelFilter, overdueOnly]);

  const activeFilterLabels = [
    search.trim() ? `Search: ${search.trim()}` : null,
    statusFilter ? `Status: ${statusFilter}` : null,
    techFilter ? `Tech: ${techFilter}` : null,
    modelFilter ? `Model: ${modelFilter}` : null,
    overdueOnly ? "Overdue only" : null,
  ].filter(Boolean) as string[];

  const columns: MatrixTableColumn<ScheduleTableRow>[] = [
    { key: "scheduledDate", header: "Date", sortable: true },
    { key: "customerName", header: "Customer", sortable: true },
    { key: "machineName", header: "Machine", sortable: true },
    { key: "assignedTechnician", header: "Technician", sortable: true },
    { key: "partsAvailability", header: "Parts", sortable: true },
    { key: "estimatedLaborHours", header: "Labor", sortable: true },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => <PMStatusBadge status={row.status as never} />,
    },
  ];

  function refresh() {
    setRows(listPmScheduleRows());
  }

  function schedule() {
    setError("");
    const result = createPmSchedule({
      printerId,
      scheduledDate: date,
      technician: tech,
      actor: "Service Manager",
      notes: "Scheduled from PM Intelligence",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Scheduled ${result.id}`);
    refresh();
  }

  function startWizard(pid: string) {
    setError("");
    const profile = profiles.find((p) => p.printerId === pid);
    const session = startPmCompletion({
      printerId: pid,
      technician: tech,
    });
    const meter = profile?.currentCopyCount ?? 0;
    session.startingMeter = meter;
    session.endingMeter = meter;
    session.checklist = session.checklist.map((c) => ({
      ...c,
      completionStatus: "DONE",
      passFail: "PASS",
    }));
    const modelKitId = listIntervalRules().find(
      (r) => r.printerModel === profile?.printerModel,
    )?.requiredPartsKitId;
    const modelKit = modelKitId ? getPmPartsKit(modelKitId) : null;
    const part = modelKit?.requiredParts[0];
    if (part) {
      session.partsUsed = [{ partNumber: part.partNumber, quantity: 1 }];
    }
    updatePmCompletionSession(session);
    setWizardId(session.id);
    setNotice(`Started PM completion ${session.id}`);
  }

  function finishWizard() {
    if (!wizardId) return;
    setError("");
    const result = finalizePmCompletion(wizardId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Completed PM ${result.session.id}`);
    setWizardId(null);
    refresh();
  }

  return (
    <MatrixShell title="PM Schedule" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="PM Schedule"
          subtitle="Schedule visits, review parts readiness, group site work, and complete PMs."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Schedule"]}
        />
        <MaintenanceSubnav />

        {error ? (
          <p
            className="mb-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {notice}
          </p>
        ) : null}

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <MatrixCard>
            <h2 className="mb-3 font-semibold text-slate-100">Schedule PM</h2>
            <div className="grid gap-3">
              <label className="text-sm">
                <span className="text-slate-500">Machine</span>
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                >
                  {profiles.map((p) => (
                    <option key={p.printerId} value={p.printerId}>
                      {p.nickname} · {p.siteName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Date</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Technician</span>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
                  value={tech}
                  onChange={(e) => setTech(e.target.value)}
                />
              </label>
              <MatrixButton type="button" onClick={schedule}>
                Schedule PM
              </MatrixButton>
            </div>
          </MatrixCard>
          {kit ? (
            <PMPartsKitCard kit={kit} availability="Warehouse check" />
          ) : null}
        </div>

        <MatrixCard className="mb-8">
          <h2 className="mb-3 font-semibold text-slate-100">Site visit planner</h2>
          <label className="mb-3 block text-sm">
            <span className="text-slate-500">Site</span>
            <select
              className="mt-1 w-full max-w-md rounded border border-slate-700 bg-slate-900 px-2 py-2"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-400">
            {plan.dueMachines.length} due/soon · {plan.cleaningsDue.length}{" "}
            cleanings · {plan.allMachines.length} machines at site
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {plan.dueMachines.map((m) => (
              <li key={m.printerId} className="flex justify-between gap-2">
                <span className="text-slate-300">{m.machineName}</span>
                <div className="flex items-center gap-2">
                  <PMStatusBadge status={m.pmStatus} />
                  <MatrixButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => startWizard(m.printerId)}
                  >
                    Start PM
                  </MatrixButton>
                </div>
              </li>
            ))}
          </ul>
          {wizardId ? (
            <div className="mt-4">
              <MatrixButton type="button" onClick={finishWizard}>
                Complete PM workflow ({wizardId})
              </MatrixButton>
            </div>
          ) : null}
        </MatrixCard>

        <MatrixCard title="Scheduled PM work">
          <EnterpriseTableToolbar
            searchPlaceholder="Search PM records"
            searchValue={search}
            onSearchChange={setSearch}
            resultCount={filteredRows.length}
            resultLabel="PM records"
            activeFilterLabels={activeFilterLabels}
            onClearFilters={() => {
              setSearch("");
              setStatusFilter("");
              setTechFilter("");
              setModelFilter("");
              setOverdueOnly(false);
            }}
            onExport={() =>
              exportRowsAsCsv("pm-schedule-filtered", filteredRows, [
                {
                  key: "scheduledDate",
                  header: "Date",
                  value: (r) => r.scheduledDate,
                },
                {
                  key: "customerName",
                  header: "Customer",
                  value: (r) => r.customerName,
                },
                {
                  key: "machineName",
                  header: "Machine",
                  value: (r) => r.machineName,
                },
                {
                  key: "assignedTechnician",
                  header: "Technician",
                  value: (r) => r.assignedTechnician,
                },
                {
                  key: "partsAvailability",
                  header: "Parts",
                  value: (r) => r.partsAvailability,
                },
                {
                  key: "estimatedLaborHours",
                  header: "Labor",
                  value: (r) => r.estimatedLaborHours,
                },
                { key: "status", header: "Status", value: (r) => r.status },
                {
                  key: "printerModel",
                  header: "Model",
                  value: (r) => r.printerModel,
                },
                {
                  key: "priority",
                  header: "Priority",
                  value: (r) => r.priority,
                },
              ])
            }
            exportLabel="Export CSV (filtered results)"
            columnOptions={COLUMN_OPTIONS}
            visibleColumnKeys={columnsVisibility.visibleKeys}
            onToggleColumn={columnsVisibility.toggle}
            selectFilters={[
              {
                id: "status",
                label: "PM status",
                value: statusFilter,
                allLabel: "All statuses",
                onChange: setStatusFilter,
                options: statuses.map((s) => ({ value: s, label: s })),
              },
              {
                id: "technician",
                label: "Technician",
                value: techFilter,
                allLabel: "All technicians",
                onChange: setTechFilter,
                options: technicians.map((t) => ({ value: t, label: t })),
              },
              {
                id: "model",
                label: "Model",
                value: modelFilter,
                allLabel: "All models",
                onChange: setModelFilter,
                options: models.map((m) => ({ value: m, label: m })),
              },
            ]}
            secondaryFilters={
              <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  className="rounded border-slate-600"
                  checked={overdueOnly}
                  onChange={(e) => setOverdueOnly(e.target.checked)}
                />
                Overdue only
              </label>
            }
          />

          {filteredRows.length === 0 ? (
            <MatrixEmptyState
              title={
                activeFilterLabels.length > 0
                  ? "No PM work matches these filters"
                  : "No PM records found"
              }
              description={
                activeFilterLabels.length > 0
                  ? "Clear filters to view more results."
                  : "Schedule a PM visit to populate this table."
              }
              className="py-10"
            />
          ) : (
            <MatrixTable
              columns={columns}
              data={filteredRows}
              rowKey={(row) => row.id}
              searchable={false}
              paginated
              pageSize={25}
              pageSizeOptions={[10, 25, 50, 100]}
              visibleColumnKeys={columnsVisibility.visibleKeys}
              stickyHeader
              compact
            />
          )}
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
