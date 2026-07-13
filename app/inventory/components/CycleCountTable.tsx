"use client";

import type { CycleCountSession } from "@/lib/warehouse";

export default function CycleCountTable({
  session,
  onChangeActual,
}: {
  session: CycleCountSession;
  onChangeActual?: (lineId: string, actualQty: number, reason: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2">Part</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Expected</th>
            <th className="px-3 py-2">Actual</th>
            <th className="px-3 py-2">Variance</th>
            <th className="px-3 py-2">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {session.lines.map((line) => (
            <tr key={line.id}>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-100">{line.partNumber}</div>
                <div className="text-xs text-slate-500">{line.description}</div>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-cyan-300">
                {line.locationCode || "—"}
              </td>
              <td className="px-3 py-2 text-slate-300">{line.expectedQty}</td>
              <td className="px-3 py-2">
                {onChangeActual && session.status === "IN_PROGRESS" ? (
                  <input
                    type="number"
                    min={0}
                    className="w-20 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                    value={line.actualQty ?? ""}
                    aria-label={`Actual quantity for ${line.partNumber}`}
                    onChange={(e) =>
                      onChangeActual(
                        line.id,
                        Number(e.target.value),
                        line.reason,
                      )
                    }
                  />
                ) : (
                  <span className="text-slate-200">{line.actualQty ?? "—"}</span>
                )}
              </td>
              <td
                className={`px-3 py-2 ${
                  (line.variance ?? 0) !== 0 ? "text-amber-300" : "text-slate-400"
                }`}
              >
                {line.variance ?? "—"}
              </td>
              <td className="px-3 py-2">
                {onChangeActual && session.status === "IN_PROGRESS" ? (
                  <input
                    type="text"
                    className="w-full min-w-[8rem] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                    value={line.reason}
                    aria-label={`Variance reason for ${line.partNumber}`}
                    onChange={(e) =>
                      onChangeActual(
                        line.id,
                        line.actualQty ?? line.expectedQty,
                        e.target.value,
                      )
                    }
                  />
                ) : (
                  <span className="text-slate-400">{line.reason || "—"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
