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
import PMStatusBadge from "../components/PMStatusBadge";
import CleaningStatusBadge from "../components/CleaningStatusBadge";
import {
  enterMeterCount,
  getMeterImportTemplate,
  importMeterCsv,
  listMeterTableRows,
  listProfiles,
} from "@/lib/pm-intelligence";

export default function MeterCountsPage() {
  const profiles = useMemo(() => listProfiles(), []);
  const [rows, setRows] = useState(() => listMeterTableRows());
  const [query, setQuery] = useState("");
  const [printerId, setPrinterId] = useState(profiles[0]?.printerId ?? "");
  const [count, setCount] = useState("");
  const [override, setOverride] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [csvText, setCsvText] = useState("");
  const [quickMode, setQuickMode] = useState(false);
  const [quickIndex, setQuickIndex] = useState(0);

  function refresh() {
    setRows(listMeterTableRows());
  }

  function submitCount() {
    setError("");
    setNotice("");
    const result = enterMeterCount({
      printerId,
      meterCount: Number(count),
      enteredBy: "Field Technician",
      notes: "",
      source: "Technician Visit",
      overrideReason: override || undefined,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(
      `Saved ${result.reading.meterCount.toLocaleString()}${
        result.warnings.length ? ` · ${result.warnings.join(" ")}` : ""
      }`,
    );
    setCount("");
    setOverride("");
    refresh();
    if (quickMode) {
      const next = Math.min(quickIndex + 1, profiles.length - 1);
      setQuickIndex(next);
      setPrinterId(profiles[next]?.printerId ?? printerId);
    }
  }

  function doImport() {
    setError("");
    const result = importMeterCsv({
      csv: csvText,
      fileName: "paste.csv",
      importedBy: "Import User",
    });
    setNotice(`Imported ${result.imported} rows (${result.batch.errorCount} errors).`);
    if (result.batch.errors[0]) setError(result.batch.errors[0].message);
    refresh();
  }

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      r.machineName.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.serialNumber.toLowerCase().includes(q)
    );
  });

  return (
    <MatrixShell title="Meter Counts" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="Meter Counts"
          subtitle="Enter, validate, and bulk-import printer meter readings. History is preserved."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Meter Counts"]}
          actions={
            <MatrixButton
              type="button"
              variant="secondary"
              onClick={() => {
                const t = getMeterImportTemplate();
                const blob = new Blob([t], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "meter-import-template.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download CSV template
            </MatrixButton>
          }
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

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <MatrixCard>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-slate-100">
                {quickMode ? "Quick update mode" : "Count entry"}
              </h2>
              <label className="flex items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={quickMode}
                  onChange={(e) => setQuickMode(e.target.checked)}
                />
                Mobile quick mode
              </label>
            </div>
            <div className="grid gap-3">
              <label className="text-sm">
                <span className="text-slate-500">Machine</span>
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                >
                  {profiles.map((p) => (
                    <option key={p.printerId} value={p.printerId}>
                      {p.nickname} · {p.customerName} ({p.currentCopyCount?.toLocaleString()})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Current meter count</span>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Override reason (if required)</span>
                <input
                  type="text"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                />
              </label>
              <MatrixButton type="button" onClick={submitCount}>
                Save count
              </MatrixButton>
            </div>
          </MatrixCard>

          <MatrixCard>
            <h2 className="mb-3 font-semibold text-slate-100">CSV import</h2>
            <textarea
              className="min-h-[10rem] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200"
              placeholder="Paste CSV here…"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              aria-label="CSV import content"
            />
            <div className="mt-3">
              <MatrixButton type="button" variant="secondary" onClick={doImport}>
                Validate & import
              </MatrixButton>
            </div>
          </MatrixCard>
        </div>

        <MatrixSearchBar
          value={query}
          onValueChange={setQuery}
          placeholder="Filter meter table…"
          className="mb-4"
        />

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Current</th>
                <th className="px-3 py-2">Prev</th>
                <th className="px-3 py-2">Avg/mo</th>
                <th className="px-3 py-2">Next PM</th>
                <th className="px-3 py-2">Remaining</th>
                <th className="px-3 py-2">Est. date</th>
                <th className="px-3 py-2">PM</th>
                <th className="px-3 py-2">Cleaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((r) => (
                <tr key={r.printerId} className="hover:bg-slate-900/40">
                  <td className="px-3 py-2 text-slate-300">{r.customerName}</td>
                  <td className="px-3 py-2 text-slate-400">{r.siteName}</td>
                  <td className="px-3 py-2 font-medium text-slate-100">
                    {r.machineName}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{r.printerModel}</td>
                  <td className="px-3 py-2 text-slate-200">
                    {r.currentMeter?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {r.previousMeter?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {r.avgMonthlyVolume?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {r.nextPmCount?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {r.impressionsRemaining?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {r.estimatedPmDate ?? "Not enough data"}
                  </td>
                  <td className="px-3 py-2">
                    <PMStatusBadge status={r.pmStatus} />
                  </td>
                  <td className="px-3 py-2">
                    <CleaningStatusBadge status={r.cleaningStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
