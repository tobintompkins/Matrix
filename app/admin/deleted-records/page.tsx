"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import RecordStateBadge from "../../components/admin/data/RecordStateBadge";
import RelationshipImpactViewer from "../../components/admin/data/RelationshipImpactViewer";
import {
  evaluatePermanentDelete,
  listDeletedRecords,
} from "@/lib/admin/data/deleted-records";
import { restoreServiceCall } from "@/lib/admin/data/service-calls";
import { restoreCustomer } from "@/lib/admin/data/customers";
import { restoreMachine } from "@/lib/admin/data/machines";
import { restorePmHistory, restorePmSchedule } from "@/lib/admin/data/pm";
import { restoreMeterEntry } from "@/lib/admin/data/meters";
import { getRelationshipImpact } from "@/lib/admin/data/relationship-impact";
import type { AdminRecordType } from "@/lib/admin/data/types";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import { MatrixButton } from "../../components/ui";

export default function AdminDeletedRecordsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const actor = {
    userId: user?.id ?? "dev-user",
    displayName: user?.fullName ?? "Matrix User",
    canEditCompleted: hasMatrixPermission(role, "EDIT_COMPLETED_SERVICE_CALL"),
    canReopenCompleted: hasMatrixPermission(role, "REOPEN_COMPLETED_PM"),
  };

  const [recordType, setRecordType] = useState<AdminRecordType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const data = useMemo(
    () => listDeletedRecords({ recordType, search, pageSize: 50 }),
    [recordType, search, message],
  );
  const selected = data.items.find(
    (r) => `${r.recordType}:${r.recordId}` === selectedId,
  );
  const impact = selected
    ? getRelationshipImpact(selected.recordType, selected.recordId)
    : null;

  return (
    <AdminShell
      title="Deleted Records"
      subtitle="Review soft-deleted operational records, validate restore eligibility, and confirm permanent deletion remains restricted."
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
            <option value="SERVICE_CALL">Service Calls</option>
            <option value="CUSTOMER">Customers</option>
            <option value="MACHINE">Machines</option>
            <option value="PM_HISTORY">PM Records</option>
            <option value="METER">Meter Records</option>
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
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Identifier</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Deleted</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Retention</th>
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
                <td className="px-3 py-2 text-white">{row.identifier}</td>
                <td className="px-3 py-2 text-slate-300">{row.name}</td>
                <td className="px-3 py-2 text-slate-400">
                  {row.deletedAt.slice(0, 10)}
                </td>
                <td className="px-3 py-2 text-slate-300">{row.reason}</td>
                <td className="px-3 py-2">
                  <RecordStateBadge
                    label={
                      row.retentionStatus === "Protected"
                        ? "Protected"
                        : row.retentionStatus === "Eligible"
                          ? "Requires Review"
                          : "Deleted"
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() =>
                      setSelectedId(`${row.recordType}:${row.recordId}`)
                    }
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No deleted records match the selected filters.
          </p>
        ) : null}
      </div>

      {selected ? (
        <section className="mt-6 space-y-4 rounded-xl border border-slate-800 p-4">
          <h2 className="text-lg font-semibold text-white">
            {selected.identifier} — {selected.name}
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Deleted By</dt>
              <dd className="text-slate-200">{selected.deletedBy}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Earliest permanent-delete date</dt>
              <dd className="text-slate-200">
                {selected.earliestPermanentDeleteDate?.slice(0, 10) ?? "—"}
              </dd>
            </div>
          </dl>
          <RelationshipImpactViewer impact={impact} />
          <div className="flex flex-wrap gap-2">
            {(selected.recordType === "SERVICE_CALL"
              ? hasMatrixPermission(role, "RESTORE_SERVICE_CALL")
              : selected.recordType === "CUSTOMER"
                ? hasMatrixPermission(role, "RESTORE_CUSTOMER")
                : selected.recordType === "MACHINE"
                  ? hasMatrixPermission(role, "RESTORE_MACHINE")
                  : selected.recordType === "METER"
                    ? hasMatrixPermission(role, "RESTORE_METER")
                    : hasMatrixPermission(role, "RESTORE_PM")) && (
              <MatrixButton
                type="button"
                onClick={() => {
                  let result: { ok: boolean; error?: string };
                  if (selected.recordType === "SERVICE_CALL") {
                    result = restoreServiceCall(selected.recordId, actor);
                  } else if (selected.recordType === "CUSTOMER") {
                    result = restoreCustomer(selected.recordId, actor);
                  } else if (selected.recordType === "MACHINE") {
                    result = restoreMachine(selected.recordId, actor);
                  } else if (selected.recordType === "PM_HISTORY") {
                    result = restorePmHistory(selected.recordId, actor);
                  } else if (selected.recordType === "PM_SCHEDULE") {
                    result = restorePmSchedule(selected.recordId, actor);
                  } else if (selected.recordType === "METER") {
                    result = restoreMeterEntry(selected.recordId, actor);
                  } else {
                    result = {
                      ok: false,
                      error: "Restore is not available for this record type.",
                    };
                  }
                  if (!result.ok) {
                    setError(result.error ?? "Restore failed.");
                    return;
                  }
                  setSelectedId(null);
                  setMessage("Record restored.");
                  setError("");
                }}
              >
                Restore
              </MatrixButton>
            )}
            <MatrixButton
              type="button"
              variant="danger"
              onClick={() => {
                const result = evaluatePermanentDelete(selected.recordType);
                setError(result.error);
              }}
            >
              Permanent Delete
            </MatrixButton>
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
