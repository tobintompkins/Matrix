"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import RecordStateBadge, {
  lifecycleToBadge,
} from "../../components/admin/data/RecordStateBadge";
import RelationshipImpactViewer from "../../components/admin/data/RelationshipImpactViewer";
import HighRiskConfirmDialog from "../../components/admin/HighRiskConfirmDialog";
import {
  archiveMachine,
  findMachineDuplicateCandidates,
  listAdminMachines,
  restoreMachine,
  retireMachine,
  softDeleteMachine,
  updateMachineAsAdmin,
  type AdminMachineRow,
} from "@/lib/admin/data/machines";
import { getRelationshipImpact } from "@/lib/admin/data/relationship-impact";
import { DEFAULT_DELETION_REASONS } from "@/lib/admin/data/deletion-reasons";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import { MatrixButton } from "../../components/ui";

export default function AdminMachinesPage() {
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
    "ACTIVE" | "ARCHIVED" | "DELETED" | "ALL" | "RETIRED"
  >("ACTIVE");
  const [selected, setSelected] = useState<AdminMachineRow | null>(null);
  const [nickname, setNickname] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const data = useMemo(
    () => listAdminMachines({ search, recordState, pageSize: 50 }),
    [search, recordState, message],
  );
  const impact = selected
    ? getRelationshipImpact("MACHINE", selected.machineId)
    : null;
  const duplicates = selected
    ? findMachineDuplicateCandidates(selected.machineId)
    : [];

  return (
    <AdminShell
      title="Machines"
      subtitle="Correct machine data, retire or archive valid history, and soft-delete invalid or test machines."
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
          Record State
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={recordState}
            onChange={(e) =>
              setRecordState(e.target.value as typeof recordState)
            }
          >
            <option value="ACTIVE">Active</option>
            <option value="RETIRED">Retired</option>
            <option value="ARCHIVED">Archived</option>
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
              <th className="px-3 py-2">Serial</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Record State</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((m) => (
              <tr key={m.machineId} className="border-t border-slate-800">
                <td className="px-3 py-2 text-white">{m.nickname}</td>
                <td className="px-3 py-2 text-slate-300">{m.serialNumber}</td>
                <td className="px-3 py-2 text-slate-300">{m.customerName}</td>
                <td className="px-3 py-2 text-slate-300">{m.status}</td>
                <td className="px-3 py-2">
                  <RecordStateBadge
                    label={lifecycleToBadge(m.recordState, {
                      retired: m.status === "RETIRED",
                    })}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => {
                      setSelected(m);
                      setNickname(m.nickname);
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
      </div>

      {selected ? (
        <section className="mt-6 space-y-4 rounded-xl border border-slate-800 p-4">
          <h2 className="text-lg font-semibold text-white">
            {selected.nickname}
          </h2>
          <RelationshipImpactViewer impact={impact} />
          {duplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 p-3 text-sm text-slate-300">
              <h3 className="font-semibold text-amber-200">
                Duplicate candidates
              </h3>
              <ul className="mt-2 space-y-1">
                {duplicates.map((d) => (
                  <li key={d.candidateId}>
                    {d.candidateName}: {d.signals.join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No duplicate candidates were found.
            </p>
          )}
          <label className="block text-sm text-slate-400">
            Machine Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>
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
                const result = updateMachineAsAdmin(
                  selected.machineId,
                  {
                    nickname,
                    expectedVersion: selected.updatedAtVersion,
                  },
                  actor,
                  reason,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setSelected(result.row);
                setMessage("Machine updated.");
              }}
            >
              Save correction
            </MatrixButton>
            {hasMatrixPermission(role, "RETIRE_MACHINE") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = retireMachine(
                    selected.machineId,
                    actor,
                    reason || "Machine retired",
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSelected(result.row);
                  setMessage("Machine retired.");
                }}
              >
                Retire
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "ARCHIVE_MACHINE") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = archiveMachine(
                    selected.machineId,
                    actor,
                    reason || "Administrative archive",
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSelected(result.row);
                  setMessage("Machine archived.");
                }}
              >
                Archive
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "DELETE_MACHINE") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => setDeleteOpen(true)}
              >
                Soft delete
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "RESTORE_MACHINE") &&
            (selected.recordState === "DELETED" ||
              selected.recordState === "ARCHIVED") ? (
              <MatrixButton
                type="button"
                onClick={() => {
                  const result = restoreMachine(
                    selected.machineId,
                    actor,
                    reason,
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSelected(result.row);
                  setMessage("Machine restored.");
                }}
              >
                Restore
              </MatrixButton>
            ) : null}
          </div>
        </section>
      ) : null}

      <HighRiskConfirmDialog
        open={deleteOpen && Boolean(selected)}
        title="Delete Machine?"
        summary={
          selected
            ? `${selected.serialNumber} · ${selected.nickname} · ${selected.customerName}`
            : ""
        }
        confirmPhrase={
          selected
            ? `DELETE ${selected.serialNumber || selected.machineId}`
            : undefined
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={(notes) => {
          if (!selected) return;
          const result = softDeleteMachine(selected.machineId, actor, {
            reason: DEFAULT_DELETION_REASONS[2].key,
            notes,
            confirmPhrase: `DELETE ${selected.serialNumber || selected.machineId}`,
          });
          setDeleteOpen(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setSelected(result.row);
          setMessage("Machine soft deleted.");
        }}
      />
    </AdminShell>
  );
}
