"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixPageHeader,
  MatrixSearchBar,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import { exportPmHistoryCsv, listPmHistory } from "@/lib/pm-intelligence";

export default function PmHistoryPage() {
  const rows = useMemo(() => listPmHistory(), []);
  const [query, setQuery] = useState("");
  const filtered = rows.filter((r) => {
    const q = query.toLowerCase();
    return (
      !q ||
      r.machineName.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.technician.toLowerCase().includes(q) ||
      r.pmType.toLowerCase().includes(q)
    );
  });

  return (
    <MatrixShell title="PM History" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="PM History"
          subtitle="Searchable completed maintenance and cleaning records."
          breadcrumbs={["Matrix", "Preventive Maintenance", "History"]}
          actions={
            <MatrixButton
              type="button"
              variant="secondary"
              onClick={() => {
                const csv = exportPmHistoryCsv();
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "pm-history.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export CSV
            </MatrixButton>
          }
        />
        <MaintenanceSubnav />
        <MatrixSearchBar
          value={query}
          onValueChange={setQuery}
          placeholder="Search history…"
          className="mb-4"
        />
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Meter</th>
                <th className="px-3 py-2">Technician</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-slate-300">{r.completionDate}</td>
                  <td className="px-3 py-2 text-slate-400">{r.customerName}</td>
                  <td className="px-3 py-2 text-slate-100">{r.machineName}</td>
                  <td className="px-3 py-2 text-slate-300">{r.pmType}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {r.meterCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{r.technician}</td>
                  <td className="px-3 py-2 text-emerald-300">{r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
