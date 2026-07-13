"use client";

import type { WarehouseStockRow, BinStockStatus } from "@/lib/warehouse";
import InventoryStatusBadge from "./InventoryStatusBadge";
import WarehouseLocationBadge from "./WarehouseLocationBadge";

export default function InventoryTable({
  rows,
  showCost = true,
  onSort,
}: {
  rows: WarehouseStockRow[];
  showCost?: boolean;
  onSort?: (key: keyof WarehouseStockRow) => void;
}) {
  if (!rows.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-slate-400">
        No inventory rows match the current filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {(
              [
                ["partNumber", "Part Number"],
                ["description", "Description"],
                ["manufacturer", "Manufacturer"],
                ["category", "Category"],
                ["compatibleModels", "Models"],
                ["quantityOnHand", "WH Qty"],
                ["quantityReserved", "Reserved"],
                ["quantityAvailable", "Available"],
                ["minimumStock", "Min"],
                ["maximumStock", "Max"],
                ["warehouseCode", "Warehouse"],
                ["locationCode", "Location"],
                ["status", "Status"],
              ] as Array<[keyof WarehouseStockRow | "locationDetail", string]>
            ).map(([key, label]) => (
              <th key={label} className="whitespace-nowrap px-3 py-2 font-semibold">
                {onSort && key !== "compatibleModels" ? (
                  <button
                    type="button"
                    className="hover:text-cyan-300"
                    onClick={() => onSort(key as keyof WarehouseStockRow)}
                  >
                    {label}
                  </button>
                ) : (
                  label
                )}
              </th>
            ))}
            {showCost ? (
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Cost</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-900/50">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-100">
                {row.partNumber}
              </td>
              <td className="max-w-[14rem] truncate px-3 py-2 text-slate-300">
                {row.description}
              </td>
              <td className="px-3 py-2 text-slate-400">{row.manufacturer}</td>
              <td className="px-3 py-2 text-slate-400">{row.category}</td>
              <td className="max-w-[10rem] truncate px-3 py-2 text-slate-400">
                {row.compatibleModels.join(", ")}
              </td>
              <td className="px-3 py-2 text-slate-200">{row.quantityOnHand}</td>
              <td className="px-3 py-2 text-slate-400">{row.quantityReserved}</td>
              <td className="px-3 py-2 text-slate-200">{row.quantityAvailable}</td>
              <td className="px-3 py-2 text-slate-400">{row.minimumStock}</td>
              <td className="px-3 py-2 text-slate-400">{row.maximumStock}</td>
              <td className="px-3 py-2 text-slate-300">{row.warehouseCode}</td>
              <td className="px-3 py-2">
                <WarehouseLocationBadge code={row.locationCode} />
                <div className="mt-1 text-[10px] text-slate-500">
                  Z:{row.zone || "—"} A:{row.aisle || "—"} R:{row.rack || "—"} S:
                  {row.shelf || "—"} B:{row.bin || "—"}
                  {row.drawer ? ` D:${row.drawer}` : ""}
                </div>
              </td>
              <td className="px-3 py-2">
                <InventoryStatusBadge status={row.status as BinStockStatus} />
              </td>
              {showCost ? (
                <td className="px-3 py-2 text-slate-300">
                  ${row.unitCost.toFixed(2)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
