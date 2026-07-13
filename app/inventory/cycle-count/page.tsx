"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
} from "../../components/ui";
import InventorySubnav from "../components/InventorySubnav";
import CycleCountTable from "../components/CycleCountTable";
import {
  completeCycleCount,
  listCycleCounts,
  listWarehouses,
  recordCycleCountActuals,
  startCycleCount,
  type CycleCountSession,
  type CycleCountType,
} from "@/lib/warehouse";

export default function CycleCountPage() {
  const warehouses = useMemo(() => listWarehouses(), []);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "wh-main");
  const [type, setType] = useState<CycleCountType>("ABC");
  const [sessions, setSessions] = useState(() => listCycleCounts());
  const [activeId, setActiveId] = useState<string | null>(
    sessions.find((s) => s.status === "IN_PROGRESS")?.id ?? null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const active: CycleCountSession | null =
    sessions.find((s) => s.id === activeId) ?? null;

  function refresh() {
    const next = listCycleCounts();
    setSessions(next);
    if (activeId) {
      const still = next.find((s) => s.id === activeId);
      if (!still) setActiveId(next[0]?.id ?? null);
    }
  }

  function create() {
    setError("");
    setNotice("");
    const result = startCycleCount({
      warehouseId,
      type,
      createdBy: "Warehouse Manager",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setActiveId(result.session.id);
    refresh();
    setNotice(`Started ${result.session.countNumber}`);
  }

  function onChangeActual(lineId: string, actualQty: number, reason: string) {
    if (!active) return;
    recordCycleCountActuals(active.id, [{ lineId, actualQty, reason }]);
    refresh();
  }

  function complete() {
    if (!active) return;
    setError("");
    const result = completeCycleCount(active.id, "Warehouse Manager");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Completed ${result.session.countNumber}`);
    refresh();
  }

  return (
    <MatrixShell title="Cycle Count" activePath="/inventory">
      <MatrixPageHeader
        title="Cycle Counting"
        subtitle="ABC, random, bin, category, and full inventory counts with variance approval."
        breadcrumbs={["Matrix", "Inventory", "Cycle Count"]}
      />
      <InventorySubnav />

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

      <MatrixCard className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-slate-500">Warehouse</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
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
          <label className="text-sm">
            <span className="text-slate-500">Count type</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100"
              value={type}
              onChange={(e) => setType(e.target.value as CycleCountType)}
            >
              <option value="ABC">ABC</option>
              <option value="RANDOM">Random</option>
              <option value="BIN">Bin</option>
              <option value="CATEGORY">Category</option>
              <option value="FULL">Full inventory</option>
            </select>
          </label>
          <div className="flex items-end">
            <MatrixButton type="button" onClick={create}>
              Start cycle count
            </MatrixButton>
          </div>
        </div>
      </MatrixCard>

      <div className="mb-4 flex flex-wrap gap-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${
              s.id === activeId
                ? "bg-cyan-500/15 text-cyan-300"
                : "bg-slate-800 text-slate-400"
            }`}
            onClick={() => setActiveId(s.id)}
          >
            {s.countNumber} ({s.status})
          </button>
        ))}
      </div>

      {active ? (
        <MatrixCard>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-100">{active.countNumber}</h2>
              <p className="text-sm text-slate-400">
                {active.type} · created by {active.createdBy}
                {active.approvedBy ? ` · approved by ${active.approvedBy}` : ""}
              </p>
            </div>
            {active.status === "IN_PROGRESS" ? (
              <MatrixButton type="button" onClick={complete}>
                Approve & complete
              </MatrixButton>
            ) : null}
          </div>
          <CycleCountTable
            session={active}
            onChangeActual={
              active.status === "IN_PROGRESS" ? onChangeActual : undefined
            }
          />
        </MatrixCard>
      ) : (
        <p className="text-slate-500">No cycle counts yet.</p>
      )}
    </MatrixShell>
  );
}
