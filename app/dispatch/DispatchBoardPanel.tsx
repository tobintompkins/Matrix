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
import { listServiceCalls } from "@/lib/service-calls";
import {
  assignTechnician,
  boardColumns,
  computeDispatchMetrics,
  filterDispatchBoard,
  getMxTicketNumber,
  getRecommendationsForTicket,
  getRepeatFailureFlags,
  getSlaForTicket,
  listTechnicians,
  PRIORITY_DEFINITIONS,
  type DispatchBoardFilters,
} from "@/lib/service-dispatch";
import { notifyTicketEvent } from "@/lib/notifications";
import type { ServiceCall } from "@/lib/service-calls";

function TicketCard({
  call,
  onAssign,
}: {
  call: ServiceCall;
  onAssign: (tech: string) => void;
}) {
  const sla = getSlaForTicket(call.id);
  const mx = getMxTicketNumber(call.id);
  const recs = getRecommendationsForTicket(call.id).slice(0, 2);
  const priorityKey =
    call.priority === "URGENT" || call.priority === "EMERGENCY"
      ? "CRITICAL"
      : call.priority === "HIGH" || call.priority === "LOW" || call.priority === "NORMAL"
        ? call.priority
        : "NORMAL";
  const priorityDef = PRIORITY_DEFINITIONS[priorityKey];

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/service-calls/${call.id}`}
          className="font-mono text-cyan-300 hover:text-cyan-200"
        >
          {mx}
        </Link>
        <span className="text-xs text-slate-400" title={priorityDef.summary}>
          {priorityDef.icon} {priorityDef.label}
        </span>
      </div>
      <p className="mt-1 font-medium text-white">{call.problem.issueTitle}</p>
      <p className="text-xs text-slate-400">
        {call.machine.customerName} · {call.machine.siteName}
      </p>
      <p className="text-xs text-slate-500">
        {call.machine.printerModel} · {call.machine.serialNumber}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <MatrixStatusBadge
          label={call.status.replaceAll("_", " ")}
          variant={
            call.status === "WAITING_FOR_PARTS"
              ? "waiting-parts"
              : call.priority === "EMERGENCY" || call.priority === "URGENT"
                ? "error"
                : "active"
          }
        />
        {sla ? (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
              sla.responseState === "BREACHED"
                ? "bg-rose-500/20 text-rose-200"
                : sla.responseState === "AT_RISK"
                  ? "bg-amber-500/20 text-amber-200"
                  : "bg-slate-700 text-slate-300"
            }`}
          >
            SLA {sla.responseState}
            {sla.minutesToResponse != null
              ? ` · ${sla.minutesToResponse}m`
              : ""}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Tech: {call.assignment.technician || "Unassigned"} · Created{" "}
        {call.createdAt.slice(0, 16)}
      </p>
      {!call.assignment.technician && recs.length > 0 ? (
        <div className="mt-2 space-y-1">
          <p className="text-[10px] uppercase text-slate-500">Recommended</p>
          {recs.map((r) => (
            <button
              key={r.technicianId}
              type="button"
              onClick={() => onAssign(r.technicianName)}
              className="block w-full rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-left text-xs text-cyan-100 hover:bg-cyan-500/20"
            >
              {r.technicianName} ({r.score}) — {r.reasons[0]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function DispatchBoardPanel() {
  const [tick, setTick] = useState(0);
  const [filters, setFilters] = useState<DispatchBoardFilters>({
    search: "",
    status: "ALL",
    priority: "ALL",
    customer: "",
    location: "",
    technician: "",
    printerModel: "",
    savedFilter: "",
  });
  const [dragTech, setDragTech] = useState("");
  const [notice, setNotice] = useState("");

  const calls = useMemo(() => {
    void tick;
    return listServiceCalls();
  }, [tick]);

  const filtered = useMemo(
    () => filterDispatchBoard(calls, filters),
    [calls, filters],
  );

  const columns = useMemo(() => boardColumns(filtered), [filtered]);
  const metrics = useMemo(() => computeDispatchMetrics(calls), [calls]);
  const technicians = useMemo(() => {
    void tick;
    return listTechnicians();
  }, [tick]);
  const repeats = useMemo(() => {
    void tick;
    return getRepeatFailureFlags();
  }, [tick]);

  function refresh() {
    setTick((t) => t + 1);
  }

  function handleAssign(ticketId: string, techName: string) {
    const result = assignTechnician(ticketId, techName, "Dispatcher");
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    notifyTicketEvent({
      type: "TICKET_ASSIGNED",
      title: `Assigned ${getMxTicketNumber(ticketId)}`,
      message: `Assigned to ${techName}`,
      ticketId,
      ticketNumber: getMxTicketNumber(ticketId),
      printerId: result.call.machine.machineId,
      printerName: result.call.machine.nickname,
      customerName: result.call.machine.customerName,
      priority: "HIGH",
    });
    setNotice(`Assigned ${getMxTicketNumber(ticketId)} → ${techName}`);
    refresh();
  }

  function applySaved(filter: string) {
    setFilters((f) => ({ ...f, savedFilter: filter, search: "", status: "ALL", priority: "ALL" }));
    if (filter === "Critical Tickets") {
      setFilters((f) => ({ ...f, priority: "URGENT", savedFilter: filter }));
    } else if (filter === "Waiting for Parts") {
      setFilters((f) => ({ ...f, status: "WAITING_FOR_PARTS", savedFilter: filter }));
    } else if (filter === "Unassigned") {
      setFilters((f) => ({ ...f, search: "", savedFilter: filter }));
    }
  }

  const columnDefs: Array<{ key: keyof typeof columns; title: string }> = [
    { key: "unassigned", title: "Unassigned" },
    { key: "assigned", title: "Assigned" },
    { key: "active", title: "Active Calls" },
    { key: "waitingForParts", title: "Waiting for Parts" },
    { key: "critical", title: "Critical" },
    { key: "completedToday", title: "Completed Today" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <MatrixStatCard label="New" value={metrics.newTickets} />
        <MatrixStatCard label="Unassigned" value={metrics.unassigned} />
        <MatrixStatCard label="Critical" value={metrics.critical} />
        <MatrixStatCard label="Traveling" value={metrics.techniciansTraveling} />
        <MatrixStatCard label="On Site" value={metrics.techniciansOnSite} />
        <MatrixStatCard label="Waiting Parts" value={metrics.waitingForParts} />
        <MatrixStatCard label="SLA at risk" value={metrics.slaAtRisk} />
        <MatrixStatCard label="SLA breached" value={metrics.slaBreached} />
        <MatrixStatCard label="Resolved today" value={metrics.resolvedToday} />
        <MatrixStatCard label="Reopened" value={metrics.reopened} />
        <MatrixStatCard
          label="First-time fix %"
          value={metrics.firstTimeFixRate == null ? "—" : `${metrics.firstTimeFixRate}%`}
        />
      </div>

      {notice ? (
        <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          "My Open Tickets",
          "Critical Tickets",
          "Waiting for Parts",
          "Unassigned",
          "Repeat Failures",
        ].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => applySaved(f)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              filters.savedFilter === f
                ? "bg-cyan-500/20 text-cyan-200"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <MatrixSearchBar
            value={filters.search}
            onValueChange={(v) => setFilters((f) => ({ ...f, search: v }))}
            placeholder="Search ticket #, serial, customer, issue…"
          />
        </div>
        <select
          value={dragTech}
          onChange={(e) => setDragTech(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
        >
          <option value="">Quick-assign technician…</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name} · {t.status} · load {t.estimatedWorkloadHours}h
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {columnDefs.map((col) => (
          <MatrixCard key={col.key} title={col.title} subtitle={`${columns[col.key].length} tickets`}>
            <div className="max-h-[28rem] space-y-3 overflow-y-auto">
              {columns[col.key].length === 0 ? (
                <MatrixEmptyState title="Empty" description="No tickets in this column." />
              ) : (
                columns[col.key].map((call) => (
                  <div
                    key={call.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragTech) handleAssign(call.id, dragTech);
                    }}
                  >
                    <TicketCard
                      call={call}
                      onAssign={(tech) => handleAssign(call.id, tech)}
                    />
                    {dragTech && !call.assignment.technician ? (
                      <MatrixButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => handleAssign(call.id, dragTech)}
                      >
                        Assign {dragTech}
                      </MatrixButton>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </MatrixCard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Technician workload" subtitle="Availability, territory, certifications.">
          <ul className="divide-y divide-slate-800 text-sm">
            {technicians.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-white">{t.name}</p>
                  <p className="text-xs text-slate-400">
                    {t.territory} · {t.supportedModels.join(", ")}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <p>{t.status.replaceAll("_", " ")}</p>
                  <p>
                    {t.dailyTicketCount} today · {t.estimatedWorkloadHours}h load
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </MatrixCard>

        <MatrixCard title="Repeat failures" subtitle="Printers needing technical review.">
          {repeats.length === 0 ? (
            <MatrixEmptyState title="No repeat failures flagged" />
          ) : (
            <ul className="space-y-3 text-sm">
              {repeats.map((r) => (
                <li key={r.printerId} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="font-medium text-amber-100">
                    Repeat Failure · {r.serialNumber || r.printerId}
                  </p>
                  <p className="text-xs text-amber-200/80">{r.recommendation}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {r.ticketCount7d} in 7d · common: {r.commonCategory || "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      </div>

      <MatrixCard
        title="Calendar / Map views"
        subtitle="Scheduling grid and map routing use the same ticket data — map tiles reserved for GPS integration."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">Calendar</p>
            <ul className="mt-2 space-y-1 text-xs">
              {filtered
                .filter((c) => c.schedule.scheduledStart)
                .slice(0, 8)
                .map((c) => (
                  <li key={c.id}>
                    {c.schedule.scheduledStart.slice(0, 16)} — {getMxTicketNumber(c.id)} ·{" "}
                    {c.assignment.technician || "Unassigned"}
                  </li>
                ))}
            </ul>
          </div>
          <div className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">Map view</p>
            <p className="mt-2 text-xs text-slate-400">
              Technician lat/lon and site coordinates are tracked for dispatch recommendations.
              Full map rendering hooks into future GPS routing without a second location system.
            </p>
          </div>
        </div>
      </MatrixCard>
    </div>
  );
}
