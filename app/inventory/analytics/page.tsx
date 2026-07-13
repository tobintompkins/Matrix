"use client";

import { useMemo } from "react";
import MatrixShell from "../../components/MatrixShell";
import { MatrixPageHeader, MatrixStatCard } from "../../components/ui";
import InventorySubnav from "../components/InventorySubnav";
import InventoryAnalyticsCard from "../components/InventoryAnalyticsCard";
import {
  getWarehouseAnalytics,
  getWarehouseDashboard,
} from "@/lib/warehouse";

export default function InventoryAnalyticsPage() {
  const metrics = useMemo(() => getWarehouseDashboard(), []);
  const analytics = useMemo(() => getWarehouseAnalytics(), []);

  return (
    <MatrixShell title="Inventory Analytics" activePath="/inventory">
      <MatrixPageHeader
        title="Inventory Analytics"
        subtitle="Value, turns, fill rate, fast movers, dead stock, receiving and transfer activity."
        breadcrumbs={["Matrix", "Inventory", "Analytics"]}
      />
      <InventorySubnav />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MatrixStatCard
          label="Inventory Value"
          value={`$${metrics.totalInventoryValue.toLocaleString()}`}
        />
        <MatrixStatCard
          label="Inventory Turns"
          value={metrics.inventoryTurns.toFixed(1)}
        />
        <MatrixStatCard
          label="Fill Rate"
          value={`${Math.round(metrics.fillRate * 100)}%`}
        />
        <MatrixStatCard
          label="Avg Days on Shelf"
          value={String(metrics.averageDaysOnShelf)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InventoryAnalyticsCard title="Warehouse comparison">
          <ul className="space-y-2 text-sm">
            {analytics.inventoryValueByWarehouse.map((w) => (
              <li key={w.warehouseId} className="flex justify-between text-slate-300">
                <span>{w.name}</span>
                <span>${w.value.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </InventoryAnalyticsCard>

        <InventoryAnalyticsCard
          title="Back orders"
          value={analytics.backOrders}
          subtitle="Parts currently back-ordered across warehouses"
        />

        <InventoryAnalyticsCard title="Fast moving parts">
          <ul className="space-y-2 text-sm">
            {analytics.fastMovingParts.map((p) => (
              <li key={p.partNumber} className="flex justify-between text-slate-300">
                <span>
                  {p.partNumber} — {p.description}
                </span>
                <span>{p.usage}</span>
              </li>
            ))}
          </ul>
        </InventoryAnalyticsCard>

        <InventoryAnalyticsCard title="Dead inventory">
          <ul className="space-y-2 text-sm">
            {analytics.deadInventory.map((p) => (
              <li key={p.partNumber} className="flex justify-between text-slate-300">
                <span>
                  {p.partNumber} ({p.onHand})
                </span>
                <span>${p.value.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </InventoryAnalyticsCard>

        <InventoryAnalyticsCard title="Critical inventory">
          <ul className="space-y-2 text-sm">
            {analytics.criticalParts.map((p) => (
              <li key={`${p.partNumber}-${p.warehouse}`} className="text-slate-300">
                {p.partNumber} · avail {p.available} · {p.warehouse}
              </li>
            ))}
          </ul>
        </InventoryAnalyticsCard>

        <InventoryAnalyticsCard title="Most expensive parts">
          <ul className="space-y-2 text-sm">
            {analytics.mostExpensiveParts.map((p) => (
              <li key={p.partNumber} className="flex justify-between text-slate-300">
                <span>{p.partNumber}</span>
                <span>
                  ${p.unitCost.toFixed(2)} · ${p.value.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </InventoryAnalyticsCard>

        <InventoryAnalyticsCard title="Receiving activity">
          <ul className="space-y-1 text-sm text-slate-400">
            {analytics.receivingActivity.length === 0 ? (
              <li>No recent receiving.</li>
            ) : (
              analytics.receivingActivity.map((d) => (
                <li key={d.date}>
                  {d.date}: {d.count}
                </li>
              ))
            )}
          </ul>
        </InventoryAnalyticsCard>

        <InventoryAnalyticsCard title="Transfer activity">
          <ul className="space-y-1 text-sm text-slate-400">
            {analytics.transferActivity.map((d) => (
              <li key={d.date}>
                {d.date}: {d.count}
              </li>
            ))}
          </ul>
        </InventoryAnalyticsCard>
      </div>
    </MatrixShell>
  );
}
