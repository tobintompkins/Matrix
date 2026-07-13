"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixStatCard,
} from "../../components/ui";
import {
  getTruckStock,
  listLocations,
  postTransaction,
  quantityAvailable,
} from "@/lib/inventory";

export default function TruckStockPage() {
  const trucks = useMemo(
    () => listLocations().filter((l) => l.type === "TECHNICIAN_VEHICLE"),
    [],
  );
  const [truckId, setTruckId] = useState(trucks[0]?.id ?? "loc-truck-alex");
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState("");
  const [countPartId, setCountPartId] = useState("");
  const [countQty, setCountQty] = useState(0);

  const summary = useMemo(() => {
    void tick;
    return getTruckStock(truckId);
  }, [tick, truckId]);

  const truck = trucks.find((t) => t.id === truckId);

  function refresh() {
    setTick((t) => t + 1);
  }

  function runCount() {
    if (!countPartId) {
      setNotice("Select a part to count.");
      return;
    }
    const result = postTransaction({
      type: "CYCLE_COUNT",
      partId: countPartId,
      quantity: countQty,
      setOnHandTo: countQty,
      reason: "Truck inventory count",
      user: truck?.technician ?? "Technician",
      sourceLocationId: truckId,
    });
    setNotice(result.ok ? "Count saved." : result.error ?? "Count failed");
    refresh();
  }

  function adjust(partId: string, delta: number) {
    const bal = summary.current.find((b) => b.partId === partId);
    if (!bal) return;
    const result = postTransaction({
      type: "ADJUSTMENT",
      partId,
      quantity: Math.abs(delta),
      setOnHandTo: Math.max(0, bal.quantityOnHand + delta),
      reason: delta > 0 ? "Manual truck adjustment +" : "Manual truck adjustment -",
      user: truck?.technician ?? "Technician",
      sourceLocationId: truckId,
    });
    setNotice(result.ok ? "Adjustment saved." : result.error ?? "Failed");
    refresh();
  }

  return (
    <MatrixShell title="Truck Stock" activePath="/inventory">
      <MatrixPageHeader
        title="Technician Truck Stock"
        subtitle={truck ? `${truck.name} · ${truck.code}` : "Select a truck"}
        breadcrumbs={["Matrix", "Inventory", "Truck Stock"]}
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

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
          value={truckId}
          onChange={(e) => setTruckId(e.target.value)}
        >
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.technician} — {t.code}
            </option>
          ))}
        </select>
        <MatrixButton variant="secondary" size="md" onClick={refresh}>
          Refresh
        </MatrixButton>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MatrixStatCard label="Current SKUs" value={summary.current.length} />
        <MatrixStatCard
          label="Reserved"
          value={summary.reserved.length}
          accent="text-amber-400"
        />
        <MatrixStatCard
          label="Low Stock"
          value={summary.lowStock.length}
          accent="text-amber-400"
        />
        <MatrixStatCard
          label="Out of Stock"
          value={summary.outOfStock.length}
          accent="text-rose-400"
        />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Current Stock">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-2 pr-3">Part</th>
                  <th className="pb-2 pr-3">On Hand</th>
                  <th className="pb-2 pr-3">Avail</th>
                  <th className="pb-2">Adjust</th>
                </tr>
              </thead>
              <tbody>
                {summary.current.map((b) => (
                  <tr key={b.id} className="border-t border-slate-800 text-slate-200">
                    <td className="py-2 pr-3 font-mono text-cyan-300">{b.partNumber}</td>
                    <td className="py-2 pr-3">{b.quantityOnHand}</td>
                    <td className="py-2 pr-3">{quantityAvailable(b)}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="mr-2 text-cyan-400"
                        onClick={() => adjust(b.partId, -1)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="text-cyan-400"
                        onClick={() => adjust(b.partId, 1)}
                      >
                        +
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MatrixCard>

        <MatrixCard title="Recent Usage">
          <ul className="space-y-2 text-sm text-slate-300">
            {summary.recentUsage.length === 0 && (
              <li className="text-slate-500">No recent consume transactions.</li>
            )}
            {summary.recentUsage.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span>
                  {t.partNumber} × {t.quantity}
                </span>
                <span className="text-slate-500">
                  {new Date(t.occurredAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </MatrixCard>
      </div>

      <MatrixCard title="Inventory Count" subtitle="Cycle count for truck stock">
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
            value={countPartId}
            onChange={(e) => {
              setCountPartId(e.target.value);
              const bal = summary.current.find((b) => b.partId === e.target.value);
              setCountQty(bal?.quantityOnHand ?? 0);
            }}
          >
            <option value="">Select part…</option>
            {summary.current.map((b) => (
              <option key={b.partId} value={b.partId}>
                {b.partNumber}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
            value={countQty}
            onChange={(e) => setCountQty(Number(e.target.value))}
          />
          <MatrixButton variant="primary" size="md" onClick={runCount}>
            Save Count
          </MatrixButton>
        </div>
      </MatrixCard>

      <MatrixCard title="Upcoming Required Parts" className="mt-6">
        <ul className="space-y-2 text-sm text-slate-300">
          <li>S-8224 — Install scheduled (Metro Print Co)</li>
          <li>014-55110 — PM due on SF9450 fleet</li>
        </ul>
        <div className="mt-4">
          <MatrixButton href="/inventory/purchase-requests" variant="secondary" size="sm">
            Request Parts
          </MatrixButton>
        </div>
      </MatrixCard>
    </MatrixShell>
  );
}
