"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import {
  exportOperationalData,
  processImportBatch,
  validateImportBatch,
  type ExportType,
  type ImportBatchResult,
  type ImportMode,
  type ImportType,
} from "@/lib/admin/completion/import-export";

export default function AdminImportExportPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canImport = hasMatrixPermission(role, "IMPORT_OPERATIONAL_DATA");
  const canExport = hasMatrixPermission(role, "EXPORT_OPERATIONAL_DATA");
  const actor =
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Administrator";

  const [importType, setImportType] = useState<ImportType>("CUSTOMERS");
  const [mode, setMode] = useState<ImportMode>("VALIDATE_ONLY");
  const [csvText, setCsvText] = useState("");
  const [batch, setBatch] = useState<ImportBatchResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  }

  function validate() {
    setError("");
    setNotice("");
    if (!canImport) {
      setError("You do not have permission to import operational data.");
      return;
    }
    const result = validateImportBatch({ importType, mode, csvText });
    setBatch(result);
    setNotice(
      `Validated: ${result.valid} valid, ${result.invalid} invalid, ${result.warnings} with warnings.`,
    );
  }

  function process() {
    setError("");
    setNotice("");
    if (!canImport) {
      setError("You do not have permission to import operational data.");
      return;
    }
    const validated =
      batch ?? validateImportBatch({ importType, mode, csvText });
    const result = processImportBatch(validated, actor);
    setBatch(result);
    setNotice(
      `Import finished: created ${result.created}, updated ${result.updated}, skipped ${result.skipped}, failed ${result.failed}.`,
    );
  }

  function onExport(exportType: ExportType) {
    setError("");
    setNotice("");
    if (!canExport) {
      setError("You do not have permission to export operational data.");
      return;
    }
    const result = exportOperationalData(exportType, actor);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Exported ${result.rowCount} row(s) to ${result.filename}.`);
  }

  return (
    <AdminShell
      title="Import / Export"
      subtitle="Staged CSV import and operational data export. Secrets and auth tokens are never included."
    >
      {!canImport && !canExport ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to import or export operational data.
        </p>
      ) : (
        <>
          {error ? (
            <p className="mb-3 text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mb-3 text-sm text-emerald-300" role="status">
              {notice}
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <MatrixCard title="Import">
              {!canImport ? (
                <p className="text-sm text-slate-500">
                  Import requires IMPORT_OPERATIONAL_DATA.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500" htmlFor="imp-type">
                      Type
                    </label>
                    <select
                      id="imp-type"
                      value={importType}
                      onChange={(e) => setImportType(e.target.value as ImportType)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="CUSTOMERS">CUSTOMERS</option>
                      <option value="MACHINES">MACHINES</option>
                      <option value="PARTS">PARTS</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500" htmlFor="imp-mode">
                      Mode
                    </label>
                    <select
                      id="imp-mode"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ImportMode)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    >
                      <option value="VALIDATE_ONLY">VALIDATE_ONLY</option>
                      <option value="CREATE_ONLY">CREATE_ONLY</option>
                      <option value="UPDATE_MATCHING">UPDATE_MATCHING</option>
                      <option value="CREATE_AND_UPDATE">CREATE_AND_UPDATE</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500" htmlFor="imp-file">
                      CSV file
                    </label>
                    <input
                      id="imp-file"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500" htmlFor="imp-text">
                      CSV text
                    </label>
                    <textarea
                      id="imp-text"
                      value={csvText}
                      onChange={(e) => setCsvText(e.target.value)}
                      rows={8}
                      placeholder="Paste CSV or upload a file…"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MatrixButton type="button" size="sm" onClick={validate}>
                      Validate
                    </MatrixButton>
                    <MatrixButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={process}
                    >
                      Process import
                    </MatrixButton>
                  </div>
                  {batch ? (
                    <div className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300">
                      <p>
                        Batch {batch.batchId}: valid {batch.valid}, invalid{" "}
                        {batch.invalid}, created {batch.created}, updated{" "}
                        {batch.updated}, skipped {batch.skipped}, failed{" "}
                        {batch.failed}.
                      </p>
                      {batch.rows.filter((r) => !r.valid).slice(0, 5).map((r) => (
                        <p key={r.rowNumber} className="mt-1 text-xs text-rose-300">
                          Row {r.rowNumber}: {r.errors.join("; ")}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </MatrixCard>

            <MatrixCard title="Export">
              {!canExport ? (
                <p className="text-sm text-slate-500">
                  Export requires EXPORT_OPERATIONAL_DATA.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      "CUSTOMERS",
                      "MACHINES",
                      "SERVICE_CALLS",
                      "PARTS",
                    ] as ExportType[]
                  ).map((t) => (
                    <MatrixButton
                      key={t}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onExport(t)}
                    >
                      Export {t}
                    </MatrixButton>
                  ))}
                </div>
              )}
            </MatrixCard>
          </div>
        </>
      )}
    </AdminShell>
  );
}
