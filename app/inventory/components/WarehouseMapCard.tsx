"use client";

import { MatrixCard } from "../../components/ui";
import type { BinLocation, WarehouseProfile } from "@/lib/warehouse";

export default function WarehouseMapCard({
  warehouse,
  bins,
}: {
  warehouse: WarehouseProfile;
  bins: BinLocation[];
}) {
  const zones = [...new Set(bins.map((b) => b.zone))].sort();
  return (
    <MatrixCard>
      <h3 className="text-sm font-semibold text-slate-200">Location map</h3>
      <p className="mt-1 text-xs text-slate-500">
        {warehouse.code} · {bins.length} bin locations · docks {warehouse.receivingDock}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {zones.map((zone) => (
          <div
            key={zone}
            className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
          >
            <p className="text-xs font-semibold uppercase text-cyan-400/80">
              Zone {zone}
            </p>
            <ul className="mt-2 space-y-1">
              {bins
                .filter((b) => b.zone === zone)
                .map((b) => (
                  <li key={b.id} className="font-mono text-[11px] text-slate-400">
                    {b.code}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </MatrixCard>
  );
}
