"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import MatrixShell from "../../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixPageHeader,
} from "../../../components/ui";
import InventorySubnav from "../../components/InventorySubnav";
import InventoryTable from "../../components/InventoryTable";
import WarehouseMapCard from "../../components/WarehouseMapCard";
import TransferTimeline from "../../components/TransferTimeline";
import CycleCountTable from "../../components/CycleCountTable";
import { getWarehouseDetail } from "@/lib/warehouse";

const TABS = [
  "Overview",
  "Inventory",
  "Receiving",
  "Shipping",
  "Transfers",
  "Cycle Counts",
  "Employees",
  "Activity Log",
] as const;

export default function WarehouseDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const detail = useMemo(() => getWarehouseDetail(id), [id]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  if (!detail) {
    return (
      <MatrixShell title="Warehouse" activePath="/inventory">
        <MatrixEmptyState
          title="Warehouse not found"
          description="The warehouse id is invalid or inactive."
          actionLabel="Back to warehouses"
          actionHref="/inventory/warehouses"
        />
      </MatrixShell>
    );
  }

  const { warehouse } = detail;

  return (
    <MatrixShell title={warehouse.name} activePath="/inventory">
      <MatrixPageHeader
        title={warehouse.name}
        subtitle={`${warehouse.code} · ${warehouse.address}`}
        breadcrumbs={["Matrix", "Inventory", "Warehouses", warehouse.code]}
        actions={
          <MatrixButton href="/inventory/receiving" size="md">
            Receive to this warehouse
          </MatrixButton>
        }
      />
      <InventorySubnav />

      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Warehouse sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-cyan-500/15 text-cyan-300"
                : "text-slate-400 hover:bg-slate-800"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MatrixCard>
              <p className="text-xs text-slate-500">Inventory value</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">
                ${detail.inventoryValue.toLocaleString()}
              </p>
            </MatrixCard>
            <MatrixCard>
              <p className="text-xs text-slate-500">Total parts</p>
              <p className="mt-1 text-2xl font-semibold text-slate-100">
                {detail.totalParts}
              </p>
            </MatrixCard>
            <MatrixCard>
              <p className="text-xs text-slate-500">Manager</p>
              <p className="mt-1 text-lg text-slate-100">{warehouse.manager}</p>
              <p className="text-sm text-slate-400">{warehouse.phone}</p>
            </MatrixCard>
            <MatrixCard>
              <p className="text-xs text-slate-500">Dock / shipping</p>
              <p className="mt-1 text-sm text-slate-200">{warehouse.receivingDock}</p>
              <p className="text-sm text-slate-400">{warehouse.shippingArea}</p>
            </MatrixCard>
          </div>
          <WarehouseMapCard warehouse={warehouse} bins={detail.bins} />
        </div>
      ) : null}

      {tab === "Inventory" ? <InventoryTable rows={detail.stock} /> : null}

      {tab === "Receiving" ? (
        <MatrixCard>
          <ul className="space-y-3">
            {detail.receiving.length === 0 ? (
              <li className="text-slate-500">No receiving sessions.</li>
            ) : (
              detail.receiving.map((r) => (
                <li key={r.id} className="flex justify-between text-sm">
                  <span className="text-slate-200">
                    {r.sessionNumber} — {r.purchaseRequestNumber}
                  </span>
                  <span className="text-slate-400">
                    {r.status} · {r.step}
                  </span>
                </li>
              ))
            )}
          </ul>
        </MatrixCard>
      ) : null}

      {tab === "Shipping" ? (
        <MatrixCard>
          <p className="text-sm text-slate-400">
            Shipping area: {warehouse.shippingArea}. Outbound transfers appear under
            Transfers.
          </p>
        </MatrixCard>
      ) : null}

      {tab === "Transfers" ? (
        <div className="space-y-4">
          {detail.transfers.map((t) => (
            <MatrixCard key={t.id}>
              <div className="mb-3 flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">{t.transferNumber}</p>
                  <p className="text-sm text-slate-400">
                    {t.kind.replaceAll("_", " ")} · {t.notes}
                  </p>
                </div>
                <span className="text-sm text-cyan-300">{t.status}</span>
              </div>
              <TransferTimeline transfer={t} />
            </MatrixCard>
          ))}
        </div>
      ) : null}

      {tab === "Cycle Counts" ? (
        <div className="space-y-4">
          {detail.cycleCounts.map((c) => (
            <MatrixCard key={c.id}>
              <p className="mb-3 font-semibold text-slate-100">
                {c.countNumber} · {c.type} · {c.status}
              </p>
              <CycleCountTable session={c} />
            </MatrixCard>
          ))}
        </div>
      ) : null}

      {tab === "Employees" ? (
        <MatrixCard>
          <ul className="divide-y divide-slate-800">
            {detail.employees.map((e) => (
              <li key={e.id} className="flex justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-100">{e.name}</p>
                  <p className="text-slate-400">{e.role}</p>
                </div>
                <div className="text-right text-slate-400">
                  <p>{e.email}</p>
                  <p>{e.phone}</p>
                </div>
              </li>
            ))}
          </ul>
        </MatrixCard>
      ) : null}

      {tab === "Activity Log" ? (
        <MatrixCard>
          <ul className="space-y-2 text-sm">
            {detail.activity.map((a) => (
              <li key={a.id} className="border-b border-slate-800/80 pb-2">
                <p className="text-slate-200">
                  {a.reason}
                  {a.partNumber ? ` · ${a.partNumber}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(a.timestamp).toLocaleString()} · {a.technician} ·{" "}
                  {a.sourceModule}
                  {a.adjustment != null ? ` · adj ${a.adjustment}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </MatrixCard>
      ) : null}
    </MatrixShell>
  );
}
