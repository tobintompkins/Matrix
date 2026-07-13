"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import { MatrixCard, MatrixPageHeader, MatrixStatCard } from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import PMStatusBadge from "../components/PMStatusBadge";
import { getExecutiveShowcase } from "@/lib/pm-intelligence";

export default function ExecutivePmPage() {
  const [presentation, setPresentation] = useState(false);
  const data = useMemo(() => getExecutiveShowcase(), []);

  return (
    <MatrixShell title="PM Executive" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="Executive Showcase"
          subtitle="Leadership view of fleet PM compliance, risk, and upcoming workload."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Executive"]}
        />
        {!presentation ? <MaintenanceSubnav /> : null}

        <div className="mb-6 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={presentation}
              onChange={(e) => setPresentation(e.target.checked)}
            />
            Presentation mode (enlarged KPIs, hide editing chrome)
          </label>
        </div>

        <div
          className={`mb-10 grid gap-4 ${
            presentation ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          <MatrixStatCard
            label="Fleet PM Compliance"
            value={`${data.fleetCompliance}%`}
            className={presentation ? "p-10" : undefined}
          />
          <MatrixStatCard
            label="Machines at Risk"
            value={data.machinesAtRisk}
            className={presentation ? "p-10" : undefined}
          />
          <MatrixStatCard
            label="PM Workload Next 30 Days"
            value={`${data.workloadNext30}h`}
            className={presentation ? "p-10" : undefined}
          />
          <MatrixStatCard
            label="Est. Downtime Prevented"
            value={`${data.estimatedDowntimePreventedHours}h`}
            trend="Estimate = forecasted PMs × 1.5h average avoided disruption"
            className={presentation ? "p-10" : undefined}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard>
            <h2 className="text-lg font-semibold text-slate-100">
              Highest-risk machines
            </h2>
            <ul className="mt-4 space-y-3">
              {data.highestRisk.map((r) => (
                <li key={r.printerId} className="flex justify-between gap-2 text-sm">
                  <span className="text-slate-200">
                    {r.machineName}
                    <span className="block text-xs text-slate-500">
                      {r.customerName} · {r.siteName}
                    </span>
                  </span>
                  <PMStatusBadge status={r.pmStatus} />
                </li>
              ))}
            </ul>
          </MatrixCard>
          <MatrixCard>
            <h2 className="text-lg font-semibold text-slate-100">
              Sites requiring attention
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {data.sitesRequiringAttention.length === 0 ? (
                <li className="text-slate-500">No sites flagged</li>
              ) : (
                data.sitesRequiringAttention.map((s) => <li key={s}>{s}</li>)
              )}
            </ul>
            <p className="mt-6 text-xs text-slate-500">
              {data.preventiveVsReactiveLabel}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Overdue PMs: {data.overdueCount} · Parts-ready schedules:{" "}
              {data.partsReadiness}
            </p>
          </MatrixCard>
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
