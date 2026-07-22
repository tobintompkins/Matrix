"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixCard } from "../../../components/ui";
import PredictiveNav from "../PredictiveNav";

export default function PredictiveForecastPage() {
  const [days, setDays] = useState("30");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      setError("");
      const res = await fetch(
        `/api/ai-operations/predictive-maintenance/forecast?days=${days}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed");
        return;
      }
      setItems(json.items);
      setNote(json.note ?? "");
    })();
  }, [days]);

  return (
    <MatrixShell title="Maintenance Forecast" activePath="/ai-operations/predictive-maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_PREDICTIVE_MAINTENANCE"]}>
        <PredictiveNav />
        <MatrixCard title="Predicted maintenance windows" subtitle="Advisory — does not reschedule official PM">
          <div className="mb-3 flex gap-2">
            {["7", "30", "60", "90"].map((d) => (
              <button
                key={d}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  days === d ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400"
                }`}
                onClick={() => setDays(d)}
              >
                {d}d
              </button>
            ))}
          </div>
          {note ? <p className="mb-3 text-xs text-amber-200/80">{note}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-2 py-2">Machine</th>
                  <th className="px-2 py-2">Customer</th>
                  <th className="px-2 py-2">Predicted date</th>
                  <th className="px-2 py-2">Window</th>
                  <th className="px-2 py-2">Risk</th>
                  <th className="px-2 py-2">Official due meter</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={String(row.machineId)} className="border-t border-slate-800">
                    <td className="px-2 py-2">
                      <Link
                        className="text-cyan-300 hover:underline"
                        href={`/ai-operations/predictive-maintenance/machines/${row.machineId}`}
                      >
                        {String(row.machineId)}
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {String(row.customerName ?? "—")}
                    </td>
                    <td className="px-2 py-2 text-white">
                      {row.predictedDate
                        ? String(row.predictedDate).slice(0, 10)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-400">
                      {row.windowStart ? String(row.windowStart).slice(0, 10) : "—"} →{" "}
                      {row.windowEnd ? String(row.windowEnd).slice(0, 10) : "—"}
                    </td>
                    <td className="px-2 py-2 text-amber-200">{String(row.riskLevel)}</td>
                    <td className="px-2 py-2 text-slate-400">
                      {row.officialDueMeter != null
                        ? String(row.officialDueMeter)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No predicted windows in range. Run fleet evaluation first.
              </p>
            ) : null}
          </div>
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
