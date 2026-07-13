"use client";

import { useState } from "react";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import {
  buildExportPayload,
  downloadTextFile,
  recordMaintenanceAudit,
  type ExportFormat,
  type ExportScope,
  type MaintenanceQueueRow,
} from "@/lib/maintenance";

type Props = {
  rows: MaintenanceQueueRow[];
  selectedIds: string[];
  customers: string[];
  canExport: boolean;
  exportedBy: string;
};

export default function MaintenanceExportPanel({
  rows,
  selectedIds,
  customers,
  canExport,
  exportedBy,
}: Props) {
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [scope, setScope] = useState<ExportScope>("current_filters");
  const [customerName, setCustomerName] = useState(customers[0] ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [message, setMessage] = useState("");

  function runExport() {
    if (!canExport) {
      setMessage("Export requires manager or administrator permission.");
      return;
    }
    const payload = buildExportPayload({
      format,
      scope,
      rows,
      selectedIds,
      customerName,
      dateFrom,
      dateTo,
      exportedBy,
    });
    downloadTextFile(payload.filename, payload.content, payload.mime);
    recordMaintenanceAudit(payload.audit);
    setMessage(`Exported ${payload.filename}`);
  }

  return (
    <MatrixCard
      title="Export Center"
      subtitle="Export entire fleet, selected printers, current filters, or a customer"
    >
      {!canExport ? (
        <p className="text-sm text-amber-300">
          You can view the dashboard, but exporting is limited to managers and
          administrators.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-400">Format</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF (text)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Scope</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={scope}
              onChange={(e) => setScope(e.target.value as ExportScope)}
            >
              <option value="entire_fleet">Entire Fleet</option>
              <option value="selected">
                Selected Printers ({selectedIds.length})
              </option>
              <option value="current_filters">Current Filters</option>
              <option value="customer">Individual Customer</option>
              <option value="date_range">Date Range (filtered rows)</option>
            </select>
          </label>
          {scope === "customer" && (
            <label className="block text-sm">
              <span className="text-slate-400">Customer</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              >
                {customers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === "date_range" && (
            <>
              <label className="block text-sm">
                <span className="text-slate-400">From</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-400">To</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
            </>
          )}
          <div className="md:col-span-2">
            <MatrixButton variant="primary" size="md" onClick={runExport}>
              Download Export
            </MatrixButton>
            {message && <p className="mt-2 text-sm text-cyan-300">{message}</p>}
            <p className="mt-2 text-xs text-slate-500">
              Export actions are written to the maintenance audit log.
            </p>
          </div>
        </div>
      )}
    </MatrixCard>
  );
}
