"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
} from "../../components/ui";
import InventorySubnav from "../components/InventorySubnav";
import TruckInventoryCard from "../components/TruckInventoryCard";
import {
  generateTruckRestockRequest,
  getTruckRestockPreview,
  listTruckRestocks,
  listWarehouses,
} from "@/lib/warehouse";
import { listLocations } from "@/lib/inventory";

export default function TruckRestockPage() {
  const trucks = useMemo(
    () => listLocations().filter((l) => l.type === "TECHNICIAN_VEHICLE"),
    [],
  );
  const warehouses = useMemo(() => listWarehouses(), []);
  const [truckId, setTruckId] = useState(trucks[0]?.id ?? "loc-truck-alex");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "wh-main");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [restocks, setRestocks] = useState(() => listTruckRestocks());

  const preview = useMemo(() => getTruckRestockPreview(truckId), [truckId]);

  function generate() {
    setError("");
    setNotice("");
    const result = generateTruckRestockRequest({
      truckLocationId: truckId,
      sourceWarehouseId: warehouseId,
      createdBy: "Warehouse Manager",
      notes: "Generated from truck restock workspace",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Created ${result.request.requestNumber} and linked transfer request.`);
    setRestocks(listTruckRestocks());
  }

  return (
    <MatrixShell title="Truck Restock" activePath="/inventory">
      <MatrixPageHeader
        title="Truck Restocking"
        subtitle="Compare current truck stock to recommended, critical, fast-moving, emergency kit, and consumable targets."
        breadcrumbs={["Matrix", "Inventory", "Truck Restock"]}
        actions={
          <MatrixButton type="button" onClick={generate}>
            Generate Restock Request
          </MatrixButton>
        }
      />
      <InventorySubnav />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-500">Technician truck</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={truckId}
            onChange={(e) => setTruckId(e.target.value)}
          >
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-500">Source warehouse</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="mb-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}

      {!preview.ok ? (
        <p className="text-slate-400">{preview.error}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TruckInventoryCard title="Current vs recommended" lines={preview.lines} />
          <TruckInventoryCard
            title="Missing critical parts"
            lines={preview.missingCritical}
            emptyLabel="No critical gaps"
          />
          <TruckInventoryCard title="Fast moving parts" lines={preview.fastMoving} />
          <TruckInventoryCard title="Emergency kit" lines={preview.emergencyKit} />
          <TruckInventoryCard title="Consumables" lines={preview.consumables} />
        </div>
      )}

      <MatrixCard className="mt-8">
        <h2 className="text-sm font-semibold text-slate-200">Recent restock requests</h2>
        {restocks.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No restock requests yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {restocks.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 text-slate-300">
                <span>
                  {r.requestNumber} — {r.truckName} ({r.technician})
                </span>
                <span className="text-slate-500">
                  {r.status} · {r.lines.length} lines
                </span>
              </li>
            ))}
          </ul>
        )}
      </MatrixCard>
    </MatrixShell>
  );
}
