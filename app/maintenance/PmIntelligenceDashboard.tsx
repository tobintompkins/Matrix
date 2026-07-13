"use client";

import { useMemo, useState } from "react";
import {
  MatrixCard,
  MatrixSearchBar,
} from "../components/ui";
import PMDashboardCard from "./components/PMDashboardCard";
import PMStatusBadge from "./components/PMStatusBadge";
import CleaningStatusBadge from "./components/CleaningStatusBadge";
import MaintenanceSubnav from "./components/MaintenanceSubnav";
import {
  getPmDashboard,
  type PmIntelligenceStatus,
} from "@/lib/pm-intelligence";

export default function PmIntelligenceDashboard() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PmIntelligenceStatus | "ALL">(
    "ALL",
  );
  const data = useMemo(() => getPmDashboard(), []);
  const { metrics, rows, cleanings } = data;

  const filtered = rows.filter((r) => {
    if (statusFilter !== "ALL" && r.pmStatus !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.siteName.toLowerCase().includes(q) ||
      r.machineName.toLowerCase().includes(q) ||
      r.serialNumber.toLowerCase().includes(q) ||
      r.printerModel.toLowerCase().includes(q)
    );
  });

  const critical = rows.filter((r) =>
    ["Critical", "Overdue", "Severely Overdue"].includes(r.pmStatus),
  );
  const dueSoon = rows.filter((r) => r.pmStatus === "Due Soon");
  const within50k = rows.filter(
    (r) =>
      r.impressionsRemaining != null &&
      r.impressionsRemaining > 0 &&
      r.impressionsRemaining <= 50_000,
  );
  const missingCounts = rows.filter((r) => !r.lastCountDate);
  const highVolume = [...rows]
    .filter((r) => r.avgMonthlyVolume != null)
    .sort((a, b) => (b.avgMonthlyVolume ?? 0) - (a.avgMonthlyVolume ?? 0))
    .slice(0, 5);

  return (
    <div>
      <MaintenanceSubnav />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <PMDashboardCard
          label="Total Active Machines"
          value={metrics.totalActiveMachines}
          href="/maintenance/counts"
        />
        <PMDashboardCard
          label="Current on PM"
          value={metrics.machinesCurrentOnPm}
          href="/maintenance/counts?status=Healthy"
        />
        <PMDashboardCard
          label="PMs Due Soon"
          value={metrics.pmsDueSoon}
          href="/maintenance/counts?status=Due%20Soon"
        />
        <PMDashboardCard
          label="PMs Due Now"
          value={metrics.pmsDueNow}
          href="/maintenance/schedule"
        />
        <PMDashboardCard
          label="Overdue PMs"
          value={metrics.overduePms}
          href="/maintenance/counts?status=Overdue"
        />
        <PMDashboardCard
          label="DTF Cleanings Due"
          value={metrics.dtfCleaningsDue}
          href="/maintenance/cleanings"
        />
        <PMDashboardCard
          label="Joint Unit Cleanings Due"
          value={metrics.jointUnitCleaningsDue}
          href="/maintenance/cleanings"
        />
        <PMDashboardCard
          label="Meter Updates Needed"
          value={metrics.meterUpdatesNeeded}
          href="/maintenance/counts"
        />
        <PMDashboardCard
          label="PM Compliance %"
          value={`${metrics.pmCompliancePercent}%`}
          href="/maintenance/reports"
        />
        <PMDashboardCard
          label="PMs Next 30 Days"
          value={metrics.estimatedPmsNext30Days}
          href="/maintenance/forecasting"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="min-w-[16rem] flex-1">
          <MatrixSearchBar
            value={query}
            onValueChange={setQuery}
            placeholder="Search customer, site, machine, serial, model…"
          />
        </div>
        <select
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PmIntelligenceStatus | "ALL")
          }
          aria-label="PM status filter"
        >
          <option value="ALL">All statuses</option>
          <option value="Healthy">Healthy</option>
          <option value="Due Soon">Due Soon</option>
          <option value="Due">Due</option>
          <option value="Critical">Critical</option>
          <option value="Overdue">Overdue</option>
          <option value="Severely Overdue">Severely Overdue</option>
          <option value="Not Enough Data">Not Enough Data</option>
        </select>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <MatrixCard>
          <h2 className="text-sm font-semibold text-slate-200">Critical machines</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {critical.length === 0 ? (
              <li className="text-slate-500">None</li>
            ) : (
              critical.slice(0, 8).map((r) => (
                <li key={r.printerId} className="flex justify-between gap-2">
                  <span className="text-slate-300">
                    {r.machineName} · {r.customerName}
                  </span>
                  <PMStatusBadge status={r.pmStatus} />
                </li>
              ))
            )}
          </ul>
        </MatrixCard>
        <MatrixCard>
          <h2 className="text-sm font-semibold text-slate-200">
            Due within 50,000 impressions
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {within50k.slice(0, 8).map((r) => (
              <li key={r.printerId} className="flex justify-between text-slate-300">
                <span>{r.machineName}</span>
                <span>{r.impressionsRemaining?.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </MatrixCard>
        <MatrixCard>
          <h2 className="text-sm font-semibold text-slate-200">Upcoming cleanings</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {cleanings
              .filter((c) => ["Due", "Due Soon", "Overdue"].includes(c.status))
              .slice(0, 8)
              .map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="text-slate-300">
                    {c.machineName} · {c.cleaningLabel}
                  </span>
                  <CleaningStatusBadge status={c.status} />
                </li>
              ))}
          </ul>
        </MatrixCard>
        <MatrixCard>
          <h2 className="text-sm font-semibold text-slate-200">
            Highest-volume machines
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {highVolume.map((r) => (
              <li key={r.printerId} className="flex justify-between text-slate-300">
                <span>{r.machineName}</span>
                <span>{r.avgMonthlyVolume?.toLocaleString()}/mo</span>
              </li>
            ))}
          </ul>
        </MatrixCard>
      </div>

      <MatrixCard>
        <h2 className="mb-3 text-sm font-semibold text-slate-200">
          Fleet PM status ({filtered.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-2 py-2">Machine</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Meter</th>
                <th className="px-2 py-2">Remaining</th>
                <th className="px-2 py-2">Est. PM</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.slice(0, 25).map((r) => (
                <tr key={r.printerId}>
                  <td className="px-2 py-2 text-slate-100">{r.machineName}</td>
                  <td className="px-2 py-2 text-slate-400">{r.customerName}</td>
                  <td className="px-2 py-2 text-slate-300">
                    {r.currentMeter?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-slate-300">
                    {r.impressionsRemaining?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-2 py-2 text-slate-400">
                    {r.estimatedPmDate ?? "Not enough data"}
                  </td>
                  <td className="px-2 py-2">
                    <PMStatusBadge status={r.pmStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dueSoon.length > 0 || missingCounts.length > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            {dueSoon.length} due soon · {missingCounts.length} missing recent counts
          </p>
        ) : null}
      </MatrixCard>
    </div>
  );
}
