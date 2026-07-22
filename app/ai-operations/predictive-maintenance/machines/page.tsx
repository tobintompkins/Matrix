"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "../../../components/ui";
import PredictiveNav from "../PredictiveNav";

type Row = {
  machineId: string;
  printerModel: string | null;
  customerName: string | null;
  healthScore: number | null;
  riskLevel: string;
  confidenceScore: number;
  dataQualityScore: number;
  predictedMaintenanceDate: string | null;
  primaryRiskReason: string | null;
  assignedTechnician: string | null;
};

export default function PredictiveMachinesPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [riskLevel, setRiskLevel] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("risk");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ sort });
      if (riskLevel) params.set("riskLevel", riskLevel);
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(
        `/api/ai-operations/predictive-maintenance/machines?${params}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed");
      setItems(json.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [riskLevel, q, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <MatrixShell
      title="Machine Health"
      activePath="/ai-operations/predictive-maintenance"
    >
      <MatrixAuthGuard requiredPermissions={["VIEW_MACHINE_HEALTH"]}>
        <PredictiveNav />
        <MatrixCard
          title="Machine health dashboard"
          subtitle="Predicted scores — labeled as predictions, not facts"
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Search machine / customer / model"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
            >
              <option value="">All risk levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MODERATE">Moderate</option>
              <option value="LOW">Low</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
            <select
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="risk">Highest risk</option>
              <option value="health">Lowest health</option>
              <option value="due">Soonest predicted PM</option>
            </select>
            <MatrixButton type="button" variant="secondary" size="sm" onClick={() => void load()}>
              Refresh
            </MatrixButton>
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Machine</th>
                    <th className="px-2 py-2">Model</th>
                    <th className="px-2 py-2">Customer</th>
                    <th className="px-2 py-2">Health</th>
                    <th className="px-2 py-2">Risk</th>
                    <th className="px-2 py-2">Confidence</th>
                    <th className="px-2 py-2">Predicted PM</th>
                    <th className="px-2 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.machineId} className="border-t border-slate-800">
                      <td className="px-2 py-2">
                        <Link
                          className="text-cyan-300 hover:underline"
                          href={`/ai-operations/predictive-maintenance/machines/${row.machineId}`}
                        >
                          {row.machineId}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-slate-300">
                        {row.printerModel ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-slate-300">
                        {row.customerName ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-white">
                        {row.healthScore ?? "—"}
                      </td>
                      <td className="px-2 py-2 text-amber-200">{row.riskLevel}</td>
                      <td className="px-2 py-2 text-slate-400">
                        {row.confidenceScore}%
                      </td>
                      <td className="px-2 py-2 text-slate-400">
                        {row.predictedMaintenanceDate
                          ? String(row.predictedMaintenanceDate).slice(0, 10)
                          : "—"}
                      </td>
                      <td className="max-w-xs truncate px-2 py-2 text-xs text-slate-500">
                        {row.primaryRiskReason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MatrixCard>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
