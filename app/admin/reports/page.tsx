"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import {
  ADMIN_REPORT_CATALOG,
  generateAdminReportCsv,
  type AdminReportGroup,
} from "@/lib/admin/completion/reports";
import { downloadCsv } from "@/lib/admin/completion/csv";

export default function AdminReportsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_ADMIN_REPORTS");
  const canExport = hasMatrixPermission(role, "EXPORT_ADMIN_REPORTS");
  const [groupFilter, setGroupFilter] = useState<AdminReportGroup | "ALL">("ALL");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const reports = useMemo(() => {
    return ADMIN_REPORT_CATALOG.filter((r) => {
      if (!hasMatrixPermission(role, r.permission)) return false;
      if (groupFilter !== "ALL" && r.group !== groupFilter) return false;
      return true;
    });
  }, [role, groupFilter]);

  const groups = useMemo(() => {
    const set = new Set(ADMIN_REPORT_CATALOG.map((r) => r.group));
    return Array.from(set);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<AdminReportGroup, typeof reports>();
    for (const r of reports) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return map;
  }, [reports]);

  function exportReport(reportId: string) {
    setError("");
    setNotice("");
    if (!canExport) {
      setError("You do not have permission to export admin reports.");
      return;
    }
    const result = generateAdminReportCsv(reportId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    downloadCsv(result.filename, result.csv);
    setNotice(`Exported ${result.rowCount} row(s) to ${result.filename}.`);
  }

  return (
    <AdminShell
      title="Admin Reports"
      subtitle="Catalog of administrative reports with CSV export for authorized roles."
    >
      {!canView ? (
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view admin reports.
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

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-400" htmlFor="report-group">
              Group
            </label>
            <select
              id="report-group"
              value={groupFilter}
              onChange={(e) =>
                setGroupFilter(e.target.value as AdminReportGroup | "ALL")
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="ALL">All groups</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {reports.length === 0 ? (
            <p className="text-sm text-slate-500">
              No reports match the selected filters.
            </p>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.entries()).map(([group, items]) => (
                <MatrixCard key={group} title={group}>
                  <ul className="space-y-3">
                    {items.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-800 px-3 py-3"
                      >
                        <div>
                          <p className="font-medium text-slate-100">{r.name}</p>
                          <p className="mt-1 text-sm text-slate-400">
                            {r.description}
                          </p>
                        </div>
                        {r.supportsExport ? (
                          <MatrixButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={!canExport}
                            onClick={() => exportReport(r.id)}
                          >
                            Export CSV
                          </MatrixButton>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </MatrixCard>
              ))}
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
