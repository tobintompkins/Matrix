"use client";

import { useMemo } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixStatCard,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import {
  exportPmHistoryCsv,
  getPmDashboard,
  listPmHistory,
  listMeterTableRows,
} from "@/lib/pm-intelligence";

export default function PmReportsPage() {
  const { metrics, rows } = useMemo(() => getPmDashboard(), []);
  const history = useMemo(() => listPmHistory(), []);
  const missing = listMeterTableRows().filter((r) => !r.lastCountDate);

  function download(name: string, content: string) {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MatrixShell title="PM Reports" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="Compliance Reports"
          subtitle="Management-ready PM, cleaning, and meter compliance summaries."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Reports"]}
        />
        <MaintenanceSubnav />

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MatrixStatCard
            label="PM Compliance"
            value={`${metrics.pmCompliancePercent}%`}
          />
          <MatrixStatCard label="Overdue PMs" value={metrics.overduePms} />
          <MatrixStatCard
            label="Completions on record"
            value={history.length}
          />
          <MatrixStatCard label="Missing meter counts" value={missing.length} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard>
            <h3 className="font-semibold text-slate-100">PM Compliance Report</h3>
            <p className="mt-2 text-sm text-slate-400">
              {metrics.machinesCurrentOnPm} of {metrics.totalActiveMachines} machines
              are current. {metrics.overduePms} overdue.
            </p>
            <div className="mt-4">
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  download(
                    "pm-compliance.csv",
                    [
                      "Machine,Customer,Status,Remaining",
                      ...rows.map(
                        (r) =>
                          `"${r.machineName}","${r.customerName}","${r.pmStatus}",${r.impressionsRemaining ?? ""}`,
                      ),
                    ].join("\n"),
                  )
                }
              >
                Export CSV
              </MatrixButton>
            </div>
          </MatrixCard>
          <MatrixCard>
            <h3 className="font-semibold text-slate-100">Completion Report</h3>
            <p className="mt-2 text-sm text-slate-400">
              {history.length} historical maintenance completions available for export.
            </p>
            <div className="mt-4">
              <MatrixButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => download("pm-completions.csv", exportPmHistoryCsv())}
              >
                Export CSV
              </MatrixButton>
            </div>
          </MatrixCard>
          <MatrixCard>
            <h3 className="font-semibold text-slate-100">Missing Meter Counts</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {missing.slice(0, 8).map((r) => (
                <li key={r.printerId}>
                  {r.machineName} · {r.customerName}
                </li>
              ))}
              {missing.length === 0 ? (
                <li className="text-slate-500">All machines have recent counts.</li>
              ) : null}
            </ul>
          </MatrixCard>
          <MatrixCard>
            <h3 className="font-semibold text-slate-100">Overdue PM Report</h3>
            <ul className="mt-3 space-y-1 text-sm text-slate-300">
              {rows
                .filter((r) =>
                  ["Overdue", "Severely Overdue"].includes(r.pmStatus),
                )
                .map((r) => (
                  <li key={r.printerId}>
                    {r.machineName} · {r.pmStatus}
                  </li>
                ))}
            </ul>
          </MatrixCard>
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
