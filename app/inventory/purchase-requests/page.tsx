"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixStatusBadge,
} from "../../components/ui";
import {
  createPurchaseRequest,
  listCatalog,
  listPurchaseRequests,
  listVendors,
  type PurchaseRequestStatus,
} from "@/lib/inventory";
import { updatePurchaseRequestStatus } from "@/lib/inventory/enterprise-repository";

function badge(status: PurchaseRequestStatus) {
  switch (status) {
    case "APPROVED":
    case "RECEIVED":
      return "completed" as const;
    case "PENDING_APPROVAL":
    case "ORDERED":
      return "warning" as const;
    case "CANCELLED":
      return "error" as const;
    default:
      return "offline" as const;
  }
}

export default function PurchaseRequestsPage() {
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState("");
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [vendorId, setVendorId] = useState("");
  const [justification, setJustification] = useState("");
  const [priority, setPriority] = useState<"CRITICAL" | "HIGH" | "NORMAL" | "LOW">(
    "NORMAL",
  );

  const requests = useMemo(() => {
    void tick;
    return listPurchaseRequests();
  }, [tick]);

  const catalog = useMemo(() => {
    void tick;
    return listCatalog("", 1, 100).items;
  }, [tick]);
  const vendors = useMemo(() => {
    void tick;
    return listVendors();
  }, [tick]);

  function refresh() {
    setTick((t) => t + 1);
  }

  function submitDraft() {
    const part = catalog.find((p) => p.id === partId);
    if (!part) {
      setNotice("Select a part.");
      return;
    }
    const result = createPurchaseRequest({
      requester: "Alex Rivera",
      priority,
      vendorId: vendorId || null,
      justification: justification || "Field restock request",
      lines: [
        {
          partId: part.id,
          partNumber: part.partNumber,
          description: part.description,
          quantity: qty,
          unitCost: part.cost,
        },
      ],
    });
    if (result.ok && result.request) {
      updatePurchaseRequestStatus(result.request.id, "PENDING_APPROVAL");
      setNotice(`Created ${result.request.requestNumber}`);
      setJustification("");
      refresh();
    } else {
      setNotice(result.error ?? "Failed");
    }
  }

  function advance(id: string, status: PurchaseRequestStatus) {
    const result = updatePurchaseRequestStatus(id, status, "Jordan Lee");
    setNotice(result.ok ? `Moved to ${status}` : result.error ?? "Failed");
    refresh();
  }

  return (
    <MatrixShell title="Purchase Requests" activePath="/inventory">
      <MatrixPageHeader
        title="Purchase Requests"
        subtitle="Draft → Pending Approval → Approved → Ordered → Received"
        breadcrumbs={["Matrix", "Inventory", "Purchase Requests"]}
        actions={
          <MatrixButton href="/inventory" variant="secondary" size="md">
            Back to Inventory
          </MatrixButton>
        }
      />

      {notice && (
        <p className="mb-4 rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-4 py-2 text-sm text-cyan-200">
          {notice}
        </p>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="New Request">
          <div className="space-y-3">
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
            >
              <option value="">Select part…</option>
              {catalog
                .filter((p) => p.status === "ACTIVE")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.partNumber} — {p.description}
                  </option>
                ))}
            </select>
            <div className="flex gap-3">
              <input
                type="number"
                min={1}
                className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
              <select
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as typeof priority)
                }
              >
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="NORMAL">Normal</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <select
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              <option value="">Vendor (optional)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              rows={3}
              placeholder="Justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
            <MatrixButton variant="primary" size="md" onClick={submitDraft}>
              Submit for Approval
            </MatrixButton>
          </div>
        </MatrixCard>

        <MatrixCard title="Workflow">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
            <li>Technician creates draft / submits pending approval</li>
            <li>Manager approves or returns to draft</li>
            <li>Warehouse marks ordered with vendor</li>
            <li>Receive into location (updates on-order / on-hand)</li>
          </ol>
        </MatrixCard>
      </div>

      <MatrixCard title="All Requests">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="pb-2 pr-4">Number</th>
                <th className="pb-2 pr-4">Requester</th>
                <th className="pb-2 pr-4">Priority</th>
                <th className="pb-2 pr-4">Lines</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-800 text-slate-200">
                  <td className="py-3 pr-4 font-mono text-cyan-300">
                    {r.requestNumber}
                  </td>
                  <td className="py-3 pr-4">{r.requester}</td>
                  <td className="py-3 pr-4">{r.priority}</td>
                  <td className="py-3 pr-4">
                    {r.lines.map((l) => `${l.partNumber}×${l.quantity}`).join(", ")}
                  </td>
                  <td className="py-3 pr-4">
                    <MatrixStatusBadge
                      variant={badge(r.status)}
                      label={r.status.replaceAll("_", " ")}
                    />
                  </td>
                  <td className="py-3 space-x-2">
                    {r.status === "PENDING_APPROVAL" && (
                      <button
                        type="button"
                        className="text-cyan-400 hover:underline"
                        onClick={() => advance(r.id, "APPROVED")}
                      >
                        Approve
                      </button>
                    )}
                    {r.status === "APPROVED" && (
                      <button
                        type="button"
                        className="text-cyan-400 hover:underline"
                        onClick={() => advance(r.id, "ORDERED")}
                      >
                        Mark Ordered
                      </button>
                    )}
                    {r.status === "ORDERED" && (
                      <button
                        type="button"
                        className="text-cyan-400 hover:underline"
                        onClick={() => advance(r.id, "RECEIVED")}
                      >
                        Mark Received
                      </button>
                    )}
                    {r.status !== "CANCELLED" &&
                      r.status !== "RECEIVED" && (
                        <button
                          type="button"
                          className="text-rose-400 hover:underline"
                          onClick={() => advance(r.id, "CANCELLED")}
                        >
                          Cancel
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MatrixCard>
    </MatrixShell>
  );
}
