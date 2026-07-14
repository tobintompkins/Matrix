"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../components/admin/AdminShell";
import RecordStateBadge, {
  lifecycleToBadge,
} from "../../components/admin/data/RecordStateBadge";
import {
  archivePart,
  createInventoryCorrection,
  INVENTORY_CORRECTION_REASONS,
  listAdminParts,
  listAdminWarehouses,
  updatePartMetadataAsAdmin,
} from "@/lib/admin/data/inventory";
import { listBalances } from "@/lib/inventory/enterprise-repository";
import { hasMatrixPermission, resolveMatrixRole } from "@/lib/auth/permissions";
import { MatrixButton } from "../../components/ui";

export default function AdminInventoryPage() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const actor = {
    userId: user?.id ?? "dev-user",
    displayName: user?.fullName ?? "Matrix User",
  };

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [locationId, setLocationId] = useState("");
  const [adjustment, setAdjustment] = useState("0");
  const [correctionReason, setCorrectionReason] = useState<string>(
    INVENTORY_CORRECTION_REASONS[0],
  );

  const parts = useMemo(
    () => listAdminParts({ search, pageSize: 50 }),
    [search, message],
  );
  const warehouses = useMemo(() => listAdminWarehouses(), [message]);
  const selected = parts.items.find((p) => p.id === selectedPartId) ?? null;

  return (
    <AdminShell
      title="Parts & Inventory"
      subtitle="Correct part metadata, archive obsolete parts, and create corrective inventory transactions without rewriting history."
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

      <label className="mb-4 block text-sm text-slate-400">
        Search parts
        <input
          className="mt-1 w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950/80 text-slate-400">
            <tr>
              <th className="px-3 py-2">Part #</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Record State</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {parts.items.map((p) => (
              <tr key={p.id} className="border-t border-slate-800">
                <td className="px-3 py-2 text-white">{p.partNumber}</td>
                <td className="px-3 py-2 text-slate-300">{p.description}</td>
                <td className="px-3 py-2 text-slate-300">{p.status}</td>
                <td className="px-3 py-2">
                  <RecordStateBadge
                    label={lifecycleToBadge(
                      p.recordState === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
                    )}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => {
                      setSelectedPartId(p.id);
                      setDescription(p.description);
                      setReason("");
                      const bal = listBalances().find((b) => b.partId === p.id);
                      setLocationId(bal?.locationId ?? warehouses[0]?.id ?? "");
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
            {selected.partNumber}
          </h2>
          <label className="block text-sm text-slate-400">
            Description
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                const result = updatePartMetadataAsAdmin(
                  selected.id,
                  { description },
                  actor,
                  reason,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setMessage("Part metadata updated.");
                setError("");
              }}
            >
              Save metadata
            </MatrixButton>
            {hasMatrixPermission(role, "ARCHIVE_PART") ? (
              <MatrixButton
                type="button"
                variant="secondary"
                onClick={() => {
                  const result = archivePart(
                    selected.id,
                    actor,
                    reason || "Obsolete / discontinued",
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setMessage("Part archived. Historical transactions preserved.");
                }}
              >
                Archive part
              </MatrixButton>
            ) : null}
          </div>

          {hasMatrixPermission(role, "CREATE_INVENTORY_CORRECTION") ? (
            <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-white">
                Inventory correction
              </h3>
              <p className="text-xs text-slate-500">
                Creates a corrective transaction. Original stock history is not
                overwritten.
              </p>
              <label className="block text-sm text-slate-400">
                Warehouse / Location
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.stockOnHand} on hand)
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-400">
                Adjustment quantity (+/−)
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                />
              </label>
              <label className="block text-sm text-slate-400">
                Correction reason
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                >
                  {INVENTORY_CORRECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <MatrixButton
                type="button"
                onClick={() => {
                  const bal = listBalances(locationId).find(
                    (b) => b.partId === selected.id,
                  );
                  const previous = bal?.quantityOnHand ?? 0;
                  const result = createInventoryCorrection(
                    {
                      partId: selected.id,
                      locationId,
                      previousQuantity: previous,
                      adjustmentQuantity: Number(adjustment),
                      reason: correctionReason,
                      notes: reason,
                    },
                    actor,
                  );
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setMessage(
                    `Correction created (${result.transactionId}). Resulting qty: ${result.resultingQuantity}.`,
                  );
                  setError("");
                }}
              >
                Create correction transaction
              </MatrixButton>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 rounded-xl border border-slate-800 p-4">
        <h2 className="text-base font-semibold text-white">Warehouses</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {warehouses.map((w) => (
            <li key={w.id}>
              {w.name} — {w.stockOnHand} on hand · {w.transactionCount}{" "}
              transactions
              {!w.canDelete ? (
                <span className="ml-2 text-xs text-amber-300">
                  (cannot delete — prefer deactivation)
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
