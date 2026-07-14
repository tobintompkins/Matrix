"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import HighRiskConfirmDialog from "../../components/admin/HighRiskConfirmDialog";
import RecordStateBadge, {
  lifecycleToBadge,
} from "../../components/admin/data/RecordStateBadge";
import RelationshipImpactViewer from "../../components/admin/data/RelationshipImpactViewer";
import {
  archiveServiceCall,
  isCompletedServiceCall,
  listAdminServiceCalls,
  restoreServiceCall,
  softDeleteServiceCall,
  updateServiceCallAsAdmin,
} from "@/lib/admin/data/service-calls";
import { getRelationshipImpact } from "@/lib/admin/data/relationship-impact";
import { DEFAULT_DELETION_REASONS } from "@/lib/admin/data/deletion-reasons";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import type { ServiceCall } from "@/lib/service-calls/types";
import { MatrixButton } from "../../components/ui";

export default function AdminServiceCallsPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const actor = {
    userId: user?.id ?? "dev-user",
    displayName: user?.fullName ?? "Matrix User",
    canEditCompleted: hasMatrixPermission(role, "EDIT_COMPLETED_SERVICE_CALL"),
  };

  const [search, setSearch] = useState("");
  const [recordState, setRecordState] = useState<
    "ACTIVE" | "ARCHIVED" | "DELETED" | "ALL"
  >("ACTIVE");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ServiceCall | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("TEST_RECORD");
  const [deleteNotes, setDeleteNotes] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editReason, setEditReason] = useState("");

  const canIncludeDeleted = hasMatrixPermission(role, "VIEW_DELETED_RECORDS");

  const data = useMemo(() => {
    return listAdminServiceCalls({
      search,
      recordState:
        recordState === "DELETED" && !canIncludeDeleted ? "ACTIVE" : recordState,
      page,
      pageSize: 20,
    });
  }, [search, recordState, page, canIncludeDeleted, message]);

  const impact = selected
    ? getRelationshipImpact("SERVICE_CALL", selected.id)
    : null;

  function refreshNotice(next: string) {
    setMessage(next);
    setError("");
  }

  return (
    <AdminShell
      title="Service Calls"
      subtitle="Search, correct, archive, soft delete, and restore service calls while preserving history."
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

      <form
        className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          refreshNotice("");
        }}
      >
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
            onChange={(e) => {
              setRecordState(e.target.value as typeof recordState);
              setPage(1);
            }}
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            {canIncludeDeleted ? (
              <option value="DELETED">Deleted</option>
            ) : null}
            <option value="ALL">All (excl. deleted unless permitted)</option>
          </select>
        </label>
        <div className="flex items-end">
          <MatrixButton type="submit">Apply filters</MatrixButton>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Service Call</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Machine</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Technician</th>
              <th className="px-3 py-2 font-medium">Record State</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((call) => (
              <tr key={call.id} className="border-t border-slate-800">
                <td className="px-3 py-2 text-white">{call.workOrderNumber}</td>
                <td className="px-3 py-2 text-slate-300">
                  {call.machine.customerName}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {call.machine.serialNumber}
                </td>
                <td className="px-3 py-2 text-slate-300">{call.status}</td>
                <td className="px-3 py-2 text-slate-300">{call.priority}</td>
                <td className="px-3 py-2 text-slate-300">
                  {call.assignment.technician || "Unassigned"}
                </td>
                <td className="px-3 py-2">
                  <RecordStateBadge
                    label={lifecycleToBadge(call.recordState ?? "ACTIVE", {
                      completed: isCompletedServiceCall(call),
                    })}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => {
                      setSelected(call);
                      setEditPriority(call.priority);
                      setEditReason("");
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
            No operational records match the selected filters.
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
        <span>
          Page {data.page} · {data.total} records
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
            disabled={page * data.pageSize >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {selected ? (
        <section className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <h2 className="text-lg font-semibold text-white">
            {selected.workOrderNumber}
          </h2>
          {isCompletedServiceCall(selected) ? (
            <p className="text-sm text-amber-200" role="alert">
              This service call contains completed historical work.
              Administrative changes may affect reports, technician history,
              parts usage, PM history, customer records, and billing-related
              data.
            </p>
          ) : null}
          <RelationshipImpactViewer impact={impact} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-slate-400">
              Priority
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
              >
                {["LOW", "NORMAL", "HIGH", "URGENT", "EMERGENCY"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Reason for Change
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <MatrixButton
              type="button"
              onClick={() => {
                const result = updateServiceCallAsAdmin(
                  selected.id,
                  {
                    priority: editPriority as ServiceCall["priority"],
                    expectedVersion: selected.updatedAtVersion ?? 1,
                  },
                  actor,
                  editReason,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setSelected(result.call);
                refreshNotice("Service call updated.");
              }}
            >
              Save correction
            </MatrixButton>
            {hasMatrixPermission(role, "ARCHIVE_SERVICE_CALL") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = archiveServiceCall(
                    selected.id,
                    actor,
                    editReason || "Administrative archive",
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSelected(null);
                  refreshNotice("Service call archived.");
                }}
              >
                Archive
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "DELETE_SERVICE_CALL") &&
            selected.recordState !== "DELETED" ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => setDeleteOpen(true)}
              >
                Soft delete
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "RESTORE_SERVICE_CALL") &&
            (selected.recordState === "DELETED" ||
              selected.recordState === "ARCHIVED") ? (
              <MatrixButton
                type="button"
                onClick={() => {
                  const result = restoreServiceCall(
                    selected.id,
                    actor,
                    editReason || "Administrative restore",
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSelected(result.call);
                  refreshNotice("Service call restored.");
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
        title="Delete Service Call?"
        summary={
          selected
            ? `${selected.workOrderNumber} · ${selected.machine.customerName} · ${selected.machine.serialNumber} · ${selected.status}`
            : ""
        }
        confirmPhrase={
          selected ? `DELETE ${selected.workOrderNumber}` : undefined
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={(reason) => {
          if (!selected) return;
          const result = softDeleteServiceCall(selected.id, actor, {
            reason: deleteReason,
            notes: deleteNotes || reason,
            confirmPhrase: `DELETE ${selected.workOrderNumber}`,
          });
          setDeleteOpen(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setSelected(null);
          refreshNotice("Service call soft deleted.");
        }}
      >
        <label className="mt-3 block text-sm text-slate-400">
          Deletion reason
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          >
            {DEFAULT_DELETION_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm text-slate-400">
          Notes
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            rows={2}
            value={deleteNotes}
            onChange={(e) => setDeleteNotes(e.target.value)}
          />
        </label>
      </HighRiskConfirmDialog>
    </AdminShell>
  );
}
