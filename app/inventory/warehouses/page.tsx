"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
  MatrixSearchBar,
  MatrixStatCard,
} from "../../components/ui";
import InventorySubnav from "../components/InventorySubnav";
import InventoryTable from "../components/InventoryTable";
import WarehouseCard from "../components/WarehouseCard";
import {
  exportWarehouseStockCsv,
  getWarehouseDashboard,
  listInventoryAlerts,
  listWarehouses,
  listWarehouseStock,
  type BinStockStatus,
} from "@/lib/warehouse";

export default function WarehouseHubPage() {
  const metrics = useMemo(() => getWarehouseDashboard(), []);
  const warehouses = useMemo(() => listWarehouses(), []);
  const alerts = useMemo(() => listInventoryAlerts(true).slice(0, 5), []);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BinStockStatus | "ALL">("ALL");
  const stock = useMemo(
    () => listWarehouseStock({ query, status }),
    [query, status],
  );

  function downloadCsv() {
    const csv = exportWarehouseStockCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matrix-warehouse-inventory.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <MatrixShell title="Warehouses" activePath="/inventory">
      <MatrixPageHeader
        title="Warehouse Management"
        subtitle="Multi-location inventory, receiving, transfers, truck restock, and cycle counts."
        breadcrumbs={["Matrix", "Inventory", "Warehouses"]}
        actions={
          <div className="flex flex-wrap gap-2">
            <MatrixButton href="/inventory/receiving" size="md">
              Receive
            </MatrixButton>
            <MatrixButton href="/inventory/transfers" variant="secondary" size="md">
              Transfers
            </MatrixButton>
            <MatrixButton
              type="button"
              variant="secondary"
              size="md"
              onClick={downloadCsv}
            >
              Export CSV
            </MatrixButton>
          </div>
        }
      />
      <InventorySubnav />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MatrixStatCard
          label="Total Inventory Value"
          value={`$${metrics.totalInventoryValue.toLocaleString()}`}
        />
        <MatrixStatCard
          label="Active Parts"
          value={String(metrics.totalActiveParts)}
        />
        <MatrixStatCard
          label="Critical Low Stock"
          value={String(metrics.criticalLowStock)}
        />
        <MatrixStatCard
          label="Pending Transfers"
          value={String(metrics.pendingTransfers)}
        />
        <MatrixStatCard
          label="Pending POs"
          value={String(metrics.pendingPurchaseOrders)}
        />
        <MatrixStatCard
          label="Today's Receipts"
          value={String(metrics.todaysReceipts)}
        />
        <MatrixStatCard
          label="Truck Inventory"
          value={metrics.truckInventoryStatus}
        />
        <MatrixStatCard
          label="Warehouse Health"
          value={metrics.warehouseHealth}
        />
      </div>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Warehouses</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((w) => {
            const whStock = listWarehouseStock({ warehouseId: w.id });
            const value = whStock.reduce(
              (s, r) => s + r.quantityOnHand * r.unitCost,
              0,
            );
            return (
              <WarehouseCard
                key={w.id}
                warehouse={w}
                inventoryValue={Math.round(value)}
                totalParts={new Set(whStock.map((r) => r.partId)).size}
              />
            );
          })}
        </div>
      </section>

      {alerts.length > 0 ? (
        <MatrixCard className="mb-8">
          <h2 className="text-sm font-semibold text-slate-200">Active alerts</h2>
          <ul className="mt-3 space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="text-sm text-slate-300">
                <span className="text-amber-300">{a.type}</span> — {a.message}
              </li>
            ))}
          </ul>
        </MatrixCard>
      ) : null}

      <section>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <MatrixSearchBar
              value={query}
              onValueChange={setQuery}
              placeholder="Search part, model, barcode, bin, warehouse…"
            />
          </div>
          <label className="text-sm">
            <span className="sr-only">Status filter</span>
            <select
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as BinStockStatus | "ALL")
              }
            >
              <option value="ALL">All statuses</option>
              <option value="Healthy">Healthy</option>
              <option value="Low">Low</option>
              <option value="Critical">Critical</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Back Ordered">Back Ordered</option>
              <option value="Discontinued">Discontinued</option>
            </select>
          </label>
        </div>
        <InventoryTable rows={stock} />
      </section>
    </MatrixShell>
  );
}
