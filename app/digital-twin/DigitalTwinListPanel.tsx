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
  type MatrixStatusVariant,
} from "@/app/components/ui";
import {
  digitalTwinFleet,
  digitalTwinModels,
  digitalTwinOrganizations,
  digitalTwinTechnicians,
  MACHINE_STATUSES,
} from "@/lib/digital-twin/data";
import type {
  DigitalTwinMachine,
  MachineHealthBand,
  MachineStatus,
} from "@/lib/digital-twin/types";
import {
  getMaintenanceProfile,
  getMaintenanceStatusLabel,
  getMostUrgentMaintenanceStatus,
  toStatusDisplay,
  type MaintenanceStatus,
} from "@/lib/maintenance";

type SortKey = "status" | "meter" | "pm" | "asset" | "maintenance";
type MaintenanceFilter = MaintenanceStatus | "All";

function maintenanceVariant(status: MaintenanceStatus): MatrixStatusVariant {
  switch (status) {
    case "CURRENT":
      return "completed";
    case "DUE_SOON":
      return "warning";
    case "DUE":
    case "OVERDUE":
      return "error";
    default:
      return "offline";
  }
}

function machineMaintenanceStatus(machineId: string): MaintenanceStatus {
  const profile = getMaintenanceProfile(machineId);
  if (!profile) return "UNKNOWN";
  return getMostUrgentMaintenanceStatus(profile);
}

function statusVariant(status: MachineStatus): MatrixStatusVariant {
  switch (status) {
    case "ONLINE":
      return "completed";
    case "DEGRADED":
    case "SERVICE_REQUIRED":
    case "INSTALLATION":
      return "warning";
    case "OFFLINE":
    case "DOWN":
      return "error";
    default:
      return "offline";
  }
}

function healthClass(band: MachineHealthBand): string {
  switch (band) {
    case "HEALTHY":
      return "text-emerald-400";
    case "WATCH":
      return "text-cyan-300";
    case "AT_RISK":
      return "text-amber-300";
    case "CRITICAL":
      return "text-rose-400";
  }
}

function formatMeter(n: number): string {
  return n.toLocaleString("en-US");
}

export default function DigitalTwinListPanel() {
  const [search, setSearch] = useState("");
  const [model, setModel] = useState<string>("All");
  const [status, setStatus] = useState<MachineStatus | "All">("All");
  const [org, setOrg] = useState<string>("All");
  const [technician, setTechnician] = useState<string>("All");
  const [maintenanceFilter, setMaintenanceFilter] =
    useState<MaintenanceFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey>("asset");
  const [view, setView] = useState<"cards" | "table">("cards");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = digitalTwinFleet.filter((m) => {
      const hay = [
        m.identity.assetTag,
        m.identity.serialNumber,
        m.identity.printerModel,
        m.identity.nickname,
        m.location.customerName,
        m.location.siteName,
        m.location.physicalLocation,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !q || hay.includes(q);
      const matchesModel = model === "All" || m.identity.printerModel === model;
      const matchesStatus = status === "All" || m.operational.status === status;
      const matchesOrg = org === "All" || m.location.organization === org;
      const matchesTech =
        technician === "All" ||
        m.assignment.assignedTechnician === technician;
      const maint = machineMaintenanceStatus(m.identity.machineId);
      const matchesMaint =
        maintenanceFilter === "All" || maint === maintenanceFilter;
      const matchesCustomerSite =
        !q ||
        hay.includes(q); // search already covers customer/site
      return (
        matchesSearch &&
        matchesModel &&
        matchesStatus &&
        matchesOrg &&
        matchesTech &&
        matchesMaint &&
        matchesCustomerSite
      );
    });

    rows = [...rows].sort((a, b) => {
      if (sortKey === "meter") {
        return b.operational.currentMeterCount - a.operational.currentMeterCount;
      }
      if (sortKey === "pm") {
        return (
          a.service.currentPmMeterRemaining - b.service.currentPmMeterRemaining
        );
      }
      if (sortKey === "status") {
        return a.operational.status.localeCompare(b.operational.status);
      }
      if (sortKey === "maintenance") {
        const rank: Record<MaintenanceStatus, number> = {
          OVERDUE: 5,
          DUE: 4,
          DUE_SOON: 3,
          UNKNOWN: 2,
          CURRENT: 1,
        };
        return (
          rank[machineMaintenanceStatus(b.identity.machineId)] -
          rank[machineMaintenanceStatus(a.identity.machineId)]
        );
      }
      return a.identity.assetTag.localeCompare(b.identity.assetTag);
    });

    return rows;
  }, [search, model, status, org, technician, maintenanceFilter, sortKey]);

  const stats = useMemo(() => {
    const all = digitalTwinFleet;
    return {
      total: all.length,
      online: all.filter((m) => m.operational.status === "ONLINE").length,
      attention: all.filter((m) =>
        ["DEGRADED", "SERVICE_REQUIRED", "DOWN", "OFFLINE"].includes(
          m.operational.status,
        ),
      ).length,
      openCalls: all.reduce((sum, m) => sum + m.service.openServiceCalls, 0),
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MatrixStatCard label="Fleet Machines" value={stats.total} />
        <MatrixStatCard
          label="Online"
          value={stats.online}
          accent="text-emerald-400"
        />
        <MatrixStatCard
          label="Needs Attention"
          value={stats.attention}
          accent="text-amber-400"
        />
        <MatrixStatCard
          label="Open Service Calls"
          value={stats.openCalls}
          accent="text-rose-400"
        />
      </div>

      <MatrixCard
        title="Digital Twin Fleet"
        subtitle="Development sample data for SFX / MPX — serials are fictional."
      >
        <div className="mb-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <MatrixSearchBar
              id="dt-search"
              placeholder="Search asset, serial, model, customer, location…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <MatrixButton
              type="button"
              variant={view === "cards" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setView("cards")}
            >
              Cards
            </MatrixButton>
            <MatrixButton
              type="button"
              variant={view === "table" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setView("table")}
            >
              Table
            </MatrixButton>
          </div>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            <option value="All">All models</option>
            {digitalTwinModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MachineStatus | "All")}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            <option value="All">All statuses</option>
            {MACHINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            <option value="All">All organizations</option>
            {digitalTwinOrganizations.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            <option value="All">All technicians</option>
            {digitalTwinTechnicians.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={maintenanceFilter}
            onChange={(e) =>
              setMaintenanceFilter(e.target.value as MaintenanceFilter)
            }
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            <option value="All">All maintenance</option>
            <option value="OVERDUE">Overdue</option>
            <option value="DUE">Due</option>
            <option value="DUE_SOON">Due Soon</option>
            <option value="UNKNOWN">Setup Required</option>
            <option value="CURRENT">Current</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            <option value="asset">Sort by asset</option>
            <option value="status">Sort by status</option>
            <option value="maintenance">Sort by maintenance</option>
            <option value="meter">Sort by meter count</option>
            <option value="pm">Sort by upcoming PM</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <MatrixEmptyState
            title="No machines found"
            description="Try adjusting search or filters."
          />
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((m) => (
              <MachineCard key={m.identity.machineId} machine={m} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-950/60 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Maintenance</th>
                  <th className="px-4 py-3 font-medium">Health</th>
                  <th className="px-4 py-3 font-medium">Meter</th>
                  <th className="px-4 py-3 font-medium">PM rem.</th>
                  <th className="px-4 py-3 font-medium">Calls</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const maint = machineMaintenanceStatus(m.identity.machineId);
                  return (
                  <tr
                    key={m.identity.machineId}
                    className="border-t border-slate-800 text-slate-200"
                  >
                    <td className="px-4 py-3 font-mono text-cyan-400">
                      {m.identity.assetTag}
                    </td>
                    <td className="px-4 py-3">{m.identity.printerModel}</td>
                    <td className="px-4 py-3">
                      <MatrixStatusBadge
                        variant={statusVariant(m.operational.status)}
                        label={m.operational.status}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <MatrixStatusBadge
                        variant={maintenanceVariant(maint)}
                        label={getMaintenanceStatusLabel(maint)}
                      />
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold ${healthClass(m.health.band)}`}
                    >
                      {m.health.score} · {m.health.band}
                    </td>
                    <td className="px-4 py-3">
                      {formatMeter(m.operational.currentMeterCount)}
                    </td>
                    <td className="px-4 py-3">
                      {formatMeter(m.service.currentPmMeterRemaining)}
                    </td>
                    <td className="px-4 py-3">{m.service.openServiceCalls}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/digital-twin/${m.identity.machineId}`}
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </MatrixCard>
    </div>
  );
}

function MachineCard({ machine: m }: { machine: DigitalTwinMachine }) {
  const maint = machineMaintenanceStatus(m.identity.machineId);
  return (
    <article className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-cyan-400">
            {m.identity.assetTag}
          </p>
          <h3 className="mt-1 text-lg font-bold text-white">
            {m.identity.nickname}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            {m.identity.printerModel} · {m.location.siteName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <MatrixStatusBadge
            variant={statusVariant(m.operational.status)}
            label={m.operational.status}
          />
          <MatrixStatusBadge
            variant={maintenanceVariant(maint)}
            label={toStatusDisplay(maint)}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Health</dt>
          <dd className={`font-semibold ${healthClass(m.health.band)}`}>
            {m.health.score} · {m.health.band}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Meter</dt>
          <dd className="font-medium text-white">
            {formatMeter(m.operational.currentMeterCount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Last service</dt>
          <dd className="text-slate-200">{m.service.lastServiceDate}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">PM remaining</dt>
          <dd className="text-slate-200">
            {formatMeter(m.service.currentPmMeterRemaining)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Open calls</dt>
          <dd className="text-slate-200">{m.service.openServiceCalls}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Technician</dt>
          <dd className="text-slate-200">
            {m.assignment.assignedTechnician}
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <MatrixButton
          href={`/digital-twin/${m.identity.machineId}`}
          variant="primary"
          size="md"
          className="w-full"
        >
          Open Machine
        </MatrixButton>
      </div>
    </article>
  );
}
