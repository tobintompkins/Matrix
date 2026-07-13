"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import FieldShell from "../FieldShell";
import { enqueueOperation } from "@/lib/field";
import { listCatalog, listBalances, quantityAvailable } from "@/lib/inventory";

const TECH = "Toby Tompkins";
const TECH_ID = "tech-toby";
const TRUCK = "loc-truck-alex";

export default function FieldPartsInner() {
  const params = useSearchParams();
  const workOrderId = params.get("workOrderId") ?? "";
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [qtyUsed, setQtyUsed] = useState(1);
  const [qtyReturned, setQtyReturned] = useState(0);
  const [qtyDefective, setQtyDefective] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");

  const catalog = useMemo(
    () => listCatalog(query || barcode, 1, 40).items,
    [query, barcode],
  );
  const balances = useMemo(() => listBalances(TRUCK), []);
  const selected = catalog.find((p) => p.id === selectedId);

  async function recordUsage() {
    if (!selected) {
      setNotice("Select a part.");
      return;
    }
    if (!workOrderId) {
      setNotice("Open parts from a work order to record usage.");
      return;
    }
    const truckBal = balances.find((b) => b.partId === selected.id);
    await enqueueOperation({
      type: "PARTS_USAGE",
      userId: TECH_ID,
      technicianName: TECH,
      workOrderId,
      payload: {
        partNumber: selected.partNumber,
        description: selected.description,
        quantityUsed: qtyUsed,
        quantityReturned: qtyReturned,
        quantityDefective: qtyDefective,
        truckAvailableLastSync: truckBal ? quantityAvailable(truckBal) : 0,
        offlineInventoryLabel: "Last synchronized truck quantity",
      },
    });
    setNotice(
      `Queued parts usage for ${selected.partNumber}. Truck qty shown is last synchronized value — not a live guarantee.`,
    );
  }

  return (
    <FieldShell title="Parts">
      <p className="mb-4 text-sm text-slate-400">
        Search truck stock and catalog. Offline quantities are last synchronized values.
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Part #, description, model, assembly…"
        className="mb-3 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4"
        aria-label="Search parts"
      />
      <input
        type="text"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        placeholder="Barcode / QR input"
        className="mb-4 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4"
        aria-label="Barcode or QR code"
      />

      {notice && (
        <p className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </p>
      )}

      <ul className="mb-6 space-y-2">
        {catalog.map((p) => {
          const bal = balances.find((b) => b.partId === p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left ${
                  selectedId === p.id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-slate-800 bg-slate-900"
                }`}
              >
                <p className="font-mono text-sm text-cyan-300">{p.partNumber}</p>
                <p className="text-sm text-white">{p.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Truck avail (last sync):{" "}
                  {bal ? quantityAvailable(bal) : "—"} · Reserved{" "}
                  {bal?.quantityReserved ?? 0}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="font-semibold text-white">{selected.partNumber}</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="text-xs text-slate-400">
              Used
              <input
                type="number"
                min={0}
                value={qtyUsed}
                onChange={(e) => setQtyUsed(Number(e.target.value))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-2"
              />
            </label>
            <label className="text-xs text-slate-400">
              Returned
              <input
                type="number"
                min={0}
                value={qtyReturned}
                onChange={(e) => setQtyReturned(Number(e.target.value))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-2"
              />
            </label>
            <label className="text-xs text-slate-400">
              Defective
              <input
                type="number"
                min={0}
                value={qtyDefective}
                onChange={(e) => setQtyDefective(Number(e.target.value))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-2"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void recordUsage()}
            className="mt-4 min-h-12 w-full rounded-xl bg-cyan-500 font-semibold text-slate-950"
          >
            Record Parts Usage
          </button>
        </div>
      )}
    </FieldShell>
  );
}
