"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import { listArchivedRecords } from "@/lib/admin/data/archived-records";
import { previewPermanentDeletion } from "@/lib/admin/data/deleted-records";
import { restoreMachine } from "@/lib/admin/data/machines";
import { restoreCustomer } from "@/lib/admin/data/customers";
import { restoreServiceCall } from "@/lib/admin/data/service-calls";
import type { AdminRecordType } from "@/lib/admin/data/types";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import { MatrixButton } from "../../components/ui";

export default function ArchivedRecordsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_ARCHIVED_RECORDS");
  const canRestore =
    hasMatrixPermission(role, "RESTORE_ADMIN_RECORD") ||
    hasMatrixPermission(role, "RESTORE_MACHINE") ||
    hasMatrixPermission(role, "RESTORE_CUSTOMER");

  const [recordType, setRecordType] = useState<AdminRecordType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [restorableOnly, setRestorableOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const data = useMemo(
    () =>
      listArchivedRecords({
        recordType,
        search,
        restorableOnly,
        pageSize: 50,
      }),
    [recordType, search, restorableOnly, message],
  );

  const preview = previewId
    ? (() => {
        const [type, id] = previewId.split(":");
        return previewPermanentDeletion(type as AdminRecordType, id!);
      })()
    : null;

  if (!canView) {
    return (
      <AdminShell title="Archived Records">
        <p className="text-sm text-rose-300">
          You do not have permission to view archived records.
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Archived Records"
      subtitle="Review archived administrative records, restore eligibility, and permanent-deletion previews. History is preserved."
    >
      {message ? (
        <p className="mb-3 text-sm text-emerald-300" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-slate-400">
          Record Type
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={recordType}
            onChange={(e) =>
              setRecordType(e.target.value as typeof recordType)
            }
          >
            <option value="ALL">All</option>
            <option value="CUSTOMER">Customers</option>
            <option value="MACHINE">Systems / Machines</option>
            <option value="SERVICE_CALL">Service Calls</option>
            <option value="PART">Parts</option>
            <option value="PM_HISTORY">PM History</option>
            <option value="METER">Meters</option>
          </select>
        </label>
        <label className="text-sm text-slate-400">
          Search
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={restorableOnly}
            onChange={(e) => setRestorableOnly(e.target.checked)}
          />
          Restorable only
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Archived By</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">History</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr
                key={`${row.recordType}:${row.recordId}`}
                className="border-t border-slate-800"
              >
                <td className="px-3 py-2 text-slate-300">{row.recordType}</td>
                <td className="px-3 py-2 text-white">{row.recordName}</td>
                <td className="px-3 py-2 text-slate-400">{row.customer ?? "—"}</td>
                <td className="px-3 py-2 text-slate-400">{row.location ?? "—"}</td>
                <td className="px-3 py-2 text-slate-400">{row.archivedBy}</td>
                <td className="px-3 py-2 text-slate-400">
                  {row.archivedDate.slice(0, 10)}
                </td>
                <td className="px-3 py-2 text-slate-400">{row.archiveReason}</td>
                <td className="px-3 py-2 text-slate-300">{row.linkedHistory}</td>
                <td className="px-3 py-2 space-x-2">
                  {canRestore && row.restoreEligible ? (
                    <button
                      type="button"
                      className="text-cyan-400 hover:underline"
                      onClick={() => {
                        setError("");
                        setMessage("");
                        const actor = {
                          userId: user?.id ?? "dev-user",
                          displayName: user?.fullName ?? "Matrix User",
                          canEditCompleted: hasMatrixPermission(
                            role,
                            "EDIT_COMPLETED_SERVICE_CALL",
                          ),
                        };
                        const reason = "Restored from Archived Records Center";
                        let result:
                          | { ok: true }
                          | { ok: false; error: string }
                          | null = null;
                        if (row.recordType === "MACHINE") {
                          result = restoreMachine(row.recordId, actor, reason);
                        } else if (row.recordType === "CUSTOMER") {
                          result = restoreCustomer(row.recordId, actor, reason);
                        } else if (row.recordType === "SERVICE_CALL") {
                          result = restoreServiceCall(row.recordId, actor, reason);
                        } else {
                          setError("Restore for this record type is not available here.");
                          return;
                        }
                        if (!result.ok) setError(result.error);
                        else setMessage(`Restored ${row.recordName}.`);
                      }}
                    >
                      Restore
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-amber-300 hover:underline"
                    onClick={() =>
                      setPreviewId(`${row.recordType}:${row.recordId}`)
                    }
                  >
                    Deletion Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No archived records match.</p>
      ) : null}

      {preview ? (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
          <h2 className="mb-2 text-base font-semibold text-white">
            Permanent Deletion Preview
          </h2>
          <p>
            <span className="text-slate-500">Record:</span> {preview.recordName} (
            {preview.recordType})
          </p>
          <p>
            <span className="text-slate-500">Status:</span> {preview.currentStatus}
          </p>
          <p>
            <span className="text-slate-500">Eligibility:</span>{" "}
            {preview.deletionEligibility}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-slate-400">
            {preview.recommendedAction}
          </p>
          <MatrixButton
            className="mt-3"
            variant="secondary"
            onClick={() => setPreviewId(null)}
          >
            Close
          </MatrixButton>
        </div>
      ) : null}
    </AdminShell>
  );
}
