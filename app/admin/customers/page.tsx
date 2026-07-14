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
  archiveCustomer,
  findCustomerDuplicateCandidates,
  listAdminCustomers,
  restoreCustomer,
  softDeleteCustomer,
  updateCustomerAsAdmin,
} from "@/lib/admin/data/customers";
import { getRelationshipImpact } from "@/lib/admin/data/relationship-impact";
import { DEFAULT_DELETION_REASONS } from "@/lib/admin/data/deletion-reasons";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import type { CrmCustomer } from "@/lib/crm/types";
import { MatrixButton } from "../../components/ui";

export default function AdminCustomersPage() {
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
    "ACTIVE" | "ARCHIVED" | "DELETED" | "ALL"
  >("ACTIVE");
  const [selected, setSelected] = useState<CrmCustomer | null>(null);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const data = useMemo(
    () => listAdminCustomers({ search, recordState, pageSize: 50 }),
    [search, recordState, message],
  );

  const impact = selected
    ? getRelationshipImpact("CUSTOMER", selected.id)
    : null;
  const duplicates = selected
    ? findCustomerDuplicateCandidates(selected.id)
    : [];

  return (
    <AdminShell
      title="Customers"
      subtitle="Edit, archive, and safely soft-delete customer records without orphaning history."
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
              <th className="px-3 py-2">Customer #</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Record State</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c.id} className="border-t border-slate-800">
                <td className="px-3 py-2 text-white">{c.customerNumber}</td>
                <td className="px-3 py-2 text-slate-300">{c.name}</td>
                <td className="px-3 py-2 text-slate-300">{c.status}</td>
                <td className="px-3 py-2">
                  <RecordStateBadge
                    label={lifecycleToBadge(c.recordState ?? "ACTIVE")}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => {
                      setSelected(c);
                      setName(c.name);
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
            No operational records match the selected filters.
          </p>
        ) : null}
      </div>

      {selected ? (
        <section className="mt-6 space-y-4 rounded-xl border border-slate-800 p-4">
          <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
          <RelationshipImpactViewer impact={impact} />
          {duplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 p-3">
              <h3 className="text-sm font-semibold text-amber-200">
                Duplicate candidates
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {duplicates.map((d) => (
                  <li key={d.candidateId}>
                    {d.candidateName} — {d.signals.join("; ")}.{" "}
                    {d.recommendedAction}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">
                Customer merge is deferred until relationship reassignment is
                verified safe.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No duplicate candidates were found.
            </p>
          )}
          <label className="block text-sm text-slate-400">
            Customer Name
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            {hasMatrixPermission(role, "ADMIN_EDIT_CUSTOMER") ? (
              <MatrixButton
                type="button"
                onClick={() => {
                  const result = updateCustomerAsAdmin(
                    selected.id,
                    {
                      name,
                      expectedVersion: selected.updatedAtVersion ?? 1,
                    },
                    actor,
                    reason,
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSelected(result.customer);
                  setMessage("Customer updated.");
                  setError("");
                }}
              >
                Save correction
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "ARCHIVE_CUSTOMER") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = archiveCustomer(
                    selected.id,
                    actor,
                    reason || "Administrative archive",
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSelected(null);
                  setMessage("Customer archived.");
                }}
              >
                Archive
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "DELETE_CUSTOMER") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => setDeleteOpen(true)}
              >
                Soft delete
              </MatrixButton>
            ) : null}
            {hasMatrixPermission(role, "RESTORE_CUSTOMER") &&
            (selected.recordState === "DELETED" ||
              selected.recordState === "ARCHIVED") ? (
              <MatrixButton
                type="button"
                onClick={() => {
                  const result = restoreCustomer(selected.id, actor, reason);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setSelected(result.customer);
                  setMessage("Customer restored.");
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
        title="Delete Customer?"
        summary={
          selected
            ? `${selected.customerNumber} · ${selected.name}`
            : ""
        }
        confirmPhrase={
          selected
            ? `DELETE ${selected.customerNumber || selected.name}`
            : undefined
        }
        onCancel={() => setDeleteOpen(false)}
        onConfirm={(notes) => {
          if (!selected) return;
          const result = softDeleteCustomer(selected.id, actor, {
            reason: DEFAULT_DELETION_REASONS[0].key,
            notes,
            confirmPhrase: `DELETE ${selected.customerNumber || selected.name}`,
          });
          setDeleteOpen(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setSelected(null);
          setMessage("Customer soft deleted.");
        }}
      />
    </AdminShell>
  );
}
