"use client";

import { useCallback, useEffect, useState } from "react";
import PortalShell from "../PortalShell";
import { MatrixCard, MatrixButton } from "../../components/ui";
import { listPortalPrinters, getActiveMembership } from "@/lib/portal";

type MeterRow = {
  machineId: string;
  machineName: string;
  locationName: string;
  lastMeter: number | null;
  lastSubmittedAt: string | null;
  status: string;
};

export default function PortalMetersPage() {
  const membership = getActiveMembership();
  const [items, setItems] = useState<MeterRow[]>([]);
  const [machineId, setMachineId] = useState("");
  const [meterCount, setMeterCount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const printers = listPortalPrinters();

  const load = useCallback(async () => {
    const res = await fetch("/api/portal/meters");
    const json = await res.json();
    if (json.ok) setItems(json.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/portal/meters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId,
          meterCount: Number(meterCount),
          note,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Submit failed");
      setMessage(
        json.reading?.underReview
          ? "Submitted for review due to unusual reading."
          : "Meter reading submitted.",
      );
      setMeterCount("");
      setNote("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell title="Meter Readings">
      {!membership?.canViewMeters ? (
        <p className="text-sm text-rose-300" role="alert">
          Meter access is not enabled for your account.
        </p>
      ) : (
        <div className="space-y-6">
          <MatrixCard title="Submit meter reading">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-400">
                Machine
                <select
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select…</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.serialNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-400">
                Current reading
                <input
                  type="number"
                  value={meterCount}
                  onChange={(e) => setMeterCount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <label className="text-sm text-slate-400 md:col-span-2">
                Note
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>
            <div className="mt-3">
              <MatrixButton
                disabled={busy || !machineId || !meterCount}
                onClick={() => void submit()}
              >
                Submit reading
              </MatrixButton>
            </div>
            {message ? (
              <p className="mt-2 text-sm text-slate-300" role="status">
                {message}
              </p>
            ) : null}
          </MatrixCard>

          <MatrixCard title="Meter status">
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">No meter rows available.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {items.map((row) => (
                  <li
                    key={row.machineId}
                    className="flex flex-wrap justify-between gap-2 border-b border-slate-800 py-2"
                  >
                    <span>
                      {row.machineName} · {row.locationName}
                    </span>
                    <span className="text-slate-400">
                      {row.lastMeter?.toLocaleString() ?? "—"} · {row.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </MatrixCard>
        </div>
      )}
    </PortalShell>
  );
}
