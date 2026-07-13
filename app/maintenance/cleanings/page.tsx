"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixSearchBar,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import CleaningStatusBadge from "../components/CleaningStatusBadge";
import {
  completeCleaning,
  listCleaningSchedule,
  type CleaningTypeId,
} from "@/lib/pm-intelligence";

export default function CleaningsPage() {
  const [rows, setRows] = useState(() => listCleaningSchedule());
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        !q ||
        r.machineName.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.cleaningLabel.toLowerCase().includes(q),
    );
  }, [rows, query]);

  function complete(rowId: string, type: CleaningTypeId, printerId: string, meter: number | null) {
    setError("");
    if (meter == null) {
      setError("Machine needs a current meter before completing cleaning.");
      return;
    }
    const result = completeCleaning({
      printerId,
      cleaningType: type,
      completedMeter: meter,
      technician: "Alex Rivera",
      timeSpentMinutes: 45,
      conditionBefore: "Dust / residue present",
      conditionAfter: "Cleaned",
      notes: `Completed ${type} cleaning`,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Cleaning recorded ${result.completion.id}`);
    setRows(listCleaningSchedule());
  }

  return (
    <MatrixShell title="Cleanings" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="Cleaning Schedule"
          subtitle="DTF, joint unit, and preventive cleanings tracked separately from standard PM."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Cleanings"]}
        />
        <MaintenanceSubnav />
        {error ? (
          <p className="mb-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {notice}
          </p>
        ) : null}
        <MatrixSearchBar
          value={query}
          onValueChange={setQuery}
          placeholder="Search cleanings…"
          className="mb-4"
        />
        <MatrixCard>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Machine</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Current</th>
                  <th className="px-2 py-2">Next</th>
                  <th className="px-2 py-2">Remaining</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2 text-slate-100">
                      {r.machineName}
                      <div className="text-xs text-slate-500">{r.customerName}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-300">{r.cleaningLabel}</td>
                    <td className="px-2 py-2 text-slate-400">
                      {r.currentMeter?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-slate-400">
                      {r.nextCleaningCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {r.remainingCount?.toLocaleString() ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      <CleaningStatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2">
                      <MatrixButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          complete(r.id, r.cleaningType, r.printerId, r.currentMeter)
                        }
                      >
                        Complete
                      </MatrixButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
