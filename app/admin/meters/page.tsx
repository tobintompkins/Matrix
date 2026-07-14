"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import RecordStateBadge, {
  lifecycleToBadge,
} from "../../components/admin/data/RecordStateBadge";
import {
  correctMeterEntry,
  invalidateMeterEntry,
  listAdminMeterEntries,
  restoreMeterEntry,
  softDeleteMeterEntry,
} from "@/lib/admin/data/meters";
import { DEFAULT_DELETION_REASONS } from "@/lib/admin/data/deletion-reasons";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import { digitalTwinFleet } from "@/lib/digital-twin";
import { MatrixButton } from "../../components/ui";

/** Seed meter rows from digital twin current counts for admin review. */
function seedMeterRows() {
  return digitalTwinFleet.slice(0, 40).map((m, idx) => ({
    meterId: `meter-${m.identity.machineId}-${idx}`,
    machineId: m.identity.machineId,
    reading: m.operational.currentMeterCount,
    recordedAt: m.operational.lastReportedActivity || new Date().toISOString(),
    technician: m.assignment.assignedTechnician,
  }));
}

export default function AdminMetersPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const actor = {
    userId: user?.id ?? "dev-user",
    displayName: user?.fullName ?? "Matrix User",
  };

  const [search, setSearch] = useState("");
  const [recordState, setRecordState] = useState<
    "ACTIVE" | "DELETED" | "INVALID" | "ALL"
  >("ACTIVE");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proposed, setProposed] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const data = useMemo(
    () =>
      listAdminMeterEntries(seedMeterRows(), {
        search,
        recordState,
        pageSize: 40,
      }),
    [search, recordState, tick, message],
  );

  const selected = data.items.find((r) => r.meterId === selectedId) ?? null;

  return (
    <AdminShell
      title="Meters"
      subtitle="Correct incorrect meter entries, mark invalid readings, and restore deleted readings without silently rewriting PM history."
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
          Search
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="text-sm text-slate-400">
          Filter
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={recordState}
            onChange={(e) =>
              setRecordState(e.target.value as typeof recordState)
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="INVALID">Invalid</option>
            <option value="DELETED">Deleted</option>
            <option value="ALL">All</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Machine</th>
              <th className="px-3 py-2">Reading</th>
              <th className="px-3 py-2">Recorded</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.meterId} className="border-t border-slate-800">
                <td className="px-3 py-2 text-white">{row.machineId}</td>
                <td className="px-3 py-2 text-slate-300">
                  {row.reading.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {row.recordedAt.slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  <RecordStateBadge
                    label={lifecycleToBadge(row.recordState, {
                      invalid: row.isInvalid,
                    })}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => {
                      setSelectedId(row.meterId);
                      setProposed(String(row.reading));
                      setReason("");
                    }}
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">
            No meter entries require review.
          </p>
        ) : null}
      </div>

      {selected ? (
        <section className="mt-6 space-y-3 rounded-xl border border-slate-800 p-4">
          <h2 className="text-lg font-semibold text-white">
            Meter correction — {selected.machineId}
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Current Reading</dt>
              <dd className="text-slate-200">{selected.reading}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Proposed Reading</dt>
              <dd>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={proposed}
                  onChange={(e) => setProposed(e.target.value)}
                />
              </dd>
            </div>
          </dl>
          <p className="text-xs text-slate-500">
            Affected PM Schedules / Usage Calculations will be reevaluated
            through existing PM scheduling logic after correction — not by
            silent schedule rewrites.
          </p>
          <label className="block text-sm text-slate-400">
            Reason
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <MatrixButton
              type="button"
              onClick={() => {
                const result = correctMeterEntry(
                  {
                    meterId: selected.meterId,
                    machineId: selected.machineId,
                    currentReading: selected.reading,
                    proposedReading: Number(proposed),
                    reason,
                  },
                  actor,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setTick((t) => t + 1);
                setMessage("Meter corrected and audited.");
                setError("");
              }}
            >
              Apply correction
            </MatrixButton>
            {hasMatrixPermission(role, "INVALIDATE_METER") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = invalidateMeterEntry(
                    selected.meterId,
                    selected.machineId,
                    actor,
                    reason || "Invalid reading",
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setTick((t) => t + 1);
                  setMessage("Meter marked invalid.");
                }}
              >
                Mark invalid
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "DELETE_METER") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = softDeleteMeterEntry(
                    selected.meterId,
                    selected.machineId,
                    actor,
                    {
                      reason: DEFAULT_DELETION_REASONS[0].key,
                      notes: reason,
                    },
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setTick((t) => t + 1);
                  setMessage("Meter soft deleted.");
                }}
              >
                Soft delete
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "RESTORE_METER") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = restoreMeterEntry(
                    selected.meterId,
                    actor,
                    reason,
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setTick((t) => t + 1);
                  setMessage("Meter restored.");
                }}
              >
                Restore
              </MatrixButton>
            ) : null}
          </div>
        </section>
      ) : null}
    </AdminShell>
  );
}
