"use client";

import { MatrixCard } from "../../components/ui";
import type { WarehouseProfile } from "@/lib/warehouse";
import Link from "next/link";

export default function WarehouseCard({
  warehouse,
  inventoryValue,
  totalParts,
  activeTechnicians,
}: {
  warehouse: WarehouseProfile;
  inventoryValue?: number;
  totalParts?: number;
  activeTechnicians?: number;
}) {
  return (
    <Link href={`/inventory/warehouses/${warehouse.id}`} className="block">
      <MatrixCard className="h-full transition hover:ring-1 hover:ring-cyan-500/40">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400/80">
              {warehouse.code}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-100">
              {warehouse.name}
            </h3>
            <p className="mt-1 text-sm text-slate-400">{warehouse.address}</p>
          </div>
          <span
            className={
              warehouse.status === "ACTIVE"
                ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300"
            }
          >
            {warehouse.status}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Manager</dt>
            <dd className="text-slate-200">{warehouse.manager}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Hours</dt>
            <dd className="text-slate-200">{warehouse.hours}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Inventory value</dt>
            <dd className="text-slate-200">
              {inventoryValue != null
                ? `$${inventoryValue.toLocaleString()}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Parts / techs</dt>
            <dd className="text-slate-200">
              {totalParts ?? "—"} / {activeTechnicians ?? warehouse.activeTechnicianIds.length}
            </dd>
          </div>
        </dl>
      </MatrixCard>
    </Link>
  );
}
