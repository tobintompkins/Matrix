"use client";

import { useCallback, useEffect, useState } from "react";
import PortalShell from "../PortalShell";
import { MatrixCard, MatrixButton } from "../../components/ui";
import { listPortalPrinters } from "@/lib/portal";

type PartsRow = {
  id: string;
  requestNumber: string;
  requestType: string;
  description: string;
  quantity: number;
  status: string;
  urgency: string;
  createdAt: string;
};

export default function PortalPartsPage() {
  const [items, setItems] = useState<PartsRow[]>([]);
  const [machineId, setMachineId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("machineId") || "";
  });
  const [requestType, setRequestType] = useState("Consumables");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [urgency, setUrgency] = useState("NORMAL");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const printers = listPortalPrinters();

  const load = useCallback(async () => {
    const res = await fetch("/api/portal/parts-requests");
    const json = await res.json();
    if (json.ok) setItems(json.items ?? []);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/parts-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId: machineId || null,
          requestType,
          description,
          quantity: Number(quantity),
          urgency,
          businessReason: reason,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Submit failed");
      setMessage(`Submitted ${json.item.requestNumber}`);
      setDescription("");
      setReason("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Parts Requests">
      <div className="space-y-6">
        <MatrixCard title="Request parts or supplies">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-400">
              Machine (optional)
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">None</option>
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400">
              Request type
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                {[
                  "Consumables",
                  "Replacement Parts",
                  "Emergency Parts",
                  "Operator Supplies",
                  "Other",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400 md:col-span-2">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="text-sm text-slate-400">
              Quantity
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="text-sm text-slate-400">
              Urgency
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                {["NORMAL", "HIGH", "CRITICAL"].map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-400 md:col-span-2">
              Business reason
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          </div>
          <div className="mt-3">
            <MatrixButton
              disabled={busy || !description.trim()}
              onClick={() => void submit()}
            >
              Submit request
            </MatrixButton>
          </div>
          {message ? (
            <p className="mt-2 text-sm text-slate-300" role="status">
              {message}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            Need guided diagram ordering? Use the{" "}
            <a
              className="text-cyan-300 hover:underline"
              href={
                machineId
                  ? `/parts-order-builder?portal=1&machineId=${encodeURIComponent(machineId)}`
                  : "/parts-order-builder?portal=1"
              }
            >
              Parts Order Builder
            </a>{" "}
            (customer-safe entry — internal pricing/vendor data stay hidden).
          </p>
        </MatrixCard>

        <MatrixCard title="Your parts requests">
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">No parts requests yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-slate-800 py-2"
                >
                  <span>
                    {row.requestNumber} · {row.requestType} · {row.description}
                  </span>
                  <span className="text-slate-400">
                    Qty {row.quantity} · {row.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      </div>
    </PortalShell>
  );
}
