"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
} from "../../components/ui";
import InventorySubnav from "../components/InventorySubnav";
import TransferTimeline from "../components/TransferTimeline";
import {
  listTransfers,
  listWarehouses,
  listWarehouseStock,
  requestTransfer,
  updateTransferStatus,
  type InventoryTransferOrder,
  type TransferStatus,
} from "@/lib/warehouse";
import { listLocations } from "@/lib/inventory";

export default function TransfersPage() {
  const [transfers, setTransfers] = useState(() => listTransfers());
  const warehouses = useMemo(() => listWarehouses(), []);
  const locations = useMemo(() => listLocations(), []);
  const stock = useMemo(() => listWarehouseStock({ warehouseId: "wh-main" }), []);
  const [error, setError] = useState("");
  const [partId, setPartId] = useState(stock[0]?.partId ?? "");
  const [qty, setQty] = useState(1);
  const [fromWh, setFromWh] = useState("wh-main");
  const [toLoc, setToLoc] = useState("loc-truck-alex");

  function refresh() {
    setTransfers(listTransfers());
  }

  function create() {
    setError("");
    const row = stock.find((s) => s.partId === partId) ?? stock[0];
    if (!row) {
      setError("No stock available to transfer.");
      return;
    }
    const from = warehouses.find((w) => w.id === fromWh);
    const result = requestTransfer({
      fromWarehouseId: fromWh,
      toWarehouseId: fromWh,
      fromLocationId: from?.enterpriseLocationId ?? "loc-main",
      toLocationId: toLoc,
      requestedBy: "Warehouse Manager",
      notes: "Manual transfer request",
      lines: [
        {
          partId: row.partId,
          partNumber: row.partNumber,
          description: row.description,
          quantity: qty,
          binFromId: row.binLocationId,
        },
      ],
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  }

  function advance(t: InventoryTransferOrder, next: TransferStatus) {
    setError("");
    const result = updateTransferStatus(t.id, next, "Warehouse Manager");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  }

  const nextAction = (status: TransferStatus): TransferStatus | null => {
    const map: Partial<Record<TransferStatus, TransferStatus>> = {
      Requested: "Approved",
      Approved: "Picking",
      Picking: "Packed",
      Packed: "In Transit",
      "In Transit": "Delivered",
      Delivered: "Received",
    };
    return map[status] ?? null;
  };

  return (
    <MatrixShell title="Transfers" activePath="/inventory">
      <MatrixPageHeader
        title="Warehouse Transfers"
        subtitle="Warehouse ↔ warehouse, warehouse ↔ truck, truck ↔ truck, regional and emergency moves."
        breadcrumbs={["Matrix", "Inventory", "Transfers"]}
      />
      <InventorySubnav />

      {error ? (
        <p className="mb-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      <MatrixCard className="mb-8">
        <h2 className="text-sm font-semibold text-slate-200">New transfer request</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="text-slate-500">From warehouse</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
              value={fromWh}
              onChange={(e) => setFromWh(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-500">Destination</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
              value={toLoc}
              onChange={(e) => setToLoc(e.target.value)}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-500">Part</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
            >
              {stock.map((s) => (
                <option key={s.id} value={s.partId}>
                  {s.partNumber} — avail {s.quantityAvailable}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-500">Quantity</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="mt-4">
          <MatrixButton type="button" onClick={create}>
            Submit transfer request
          </MatrixButton>
        </div>
      </MatrixCard>

      <div className="space-y-4">
        {transfers.map((t) => {
          const next = nextAction(t.status);
          return (
            <MatrixCard key={t.id}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{t.transferNumber}</p>
                  <p className="text-sm text-slate-400">
                    {t.kind.replaceAll("_", " ")} · requested by {t.requestedBy}
                  </p>
                  <ul className="mt-2 text-sm text-slate-300">
                    {t.lines.map((l) => (
                      <li key={l.id}>
                        {l.partNumber} × {l.quantityRequested}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  {next ? (
                    <MatrixButton
                      type="button"
                      size="sm"
                      onClick={() => advance(t, next)}
                    >
                      Mark {next}
                    </MatrixButton>
                  ) : null}
                  {t.status !== "Cancelled" &&
                  t.status !== "Received" ? (
                    <MatrixButton
                      type="button"
                      size="sm"
                      variant="danger"
                      onClick={() => advance(t, "Cancelled")}
                    >
                      Cancel
                    </MatrixButton>
                  ) : null}
                </div>
              </div>
              <TransferTimeline transfer={t} />
            </MatrixCard>
          );
        })}
      </div>
    </MatrixShell>
  );
}
