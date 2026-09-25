"use client";

import { useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import type { WorkOrderQueueComparison } from "@/lib/work-orders/office-queue-compare";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../components/ui";

export default function WorkOrdersServerCompareCard() {
  const canCompare = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [comparison, setComparison] = useState<WorkOrderQueueComparison | null>(null);

  if (!canCompare) return null;

  async function runCompare() {
    setLoading(true);
    setError("");
    setComparison(null);
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        comparison?: WorkOrderQueueComparison;
        error?: string;
      };
      if (!response.ok || !body.comparison) {
        throw new Error(body.error ?? "Could not compare browser and server work orders.");
      }
      setComparison(body.comparison);
    } catch (compareError) {
      setError(
        compareError instanceof Error
          ? compareError.message
          : "Could not compare browser and server work orders.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MatrixCard
      title="Browser vs Server Comparison"
      subtitle="Read-only validation before enabling MATRIX_SERVER_OFFICE_WORK_ORDERS."
    >
      <div className="flex flex-wrap items-center gap-3">
        <MatrixButton variant="secondary" size="sm" disabled={loading} onClick={() => void runCompare()}>
          {loading ? "Comparing…" : "Compare Queues"}
        </MatrixButton>
        <span className="text-xs text-slate-400">
          Matches by work-order number and legacy browser ID. Does not copy, delete, or enable the office flag.
        </span>
      </div>

      {error && (
        <MatrixEmptyState
          title="Comparison failed"
          description={error}
          actionLabel="Retry"
          onAction={() => void runCompare()}
          className="mt-4 py-10"
        />
      )}

      {comparison && (
        <div className="mt-4 space-y-4 text-sm">
          <p
            role="status"
            className={
              comparison.readyForOfficeFlag
                ? "rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 text-emerald-200"
                : "rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-amber-200"
            }
          >
            {comparison.readyForOfficeFlag
              ? "Queues align: no missing records or key field mismatches."
              : `${comparison.missingOnServer.length} missing on server · ${comparison.missingOnBrowser.length} missing in browser · ${comparison.mismatchCount} field mismatch(es) across ${comparison.matchedCount} matched record(s).`}
          </p>
          <p className="text-xs text-slate-400">
            Browser {comparison.browserCount} · Server {comparison.serverCount} · Matched {comparison.matchedCount}
          </p>

          {comparison.missingOnServer.length > 0 && (
            <section>
              <h3 className="font-semibold text-rose-200">Missing on server</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {comparison.missingOnServer.map((row) => (
                  <li key={row.id}>
                    {row.workOrderNumber} · {row.title} · browser id {row.id}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {comparison.missingOnBrowser.length > 0 && (
            <section>
              <h3 className="font-semibold text-amber-200">Missing in browser</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {comparison.missingOnBrowser.map((row) => (
                  <li key={row.id}>
                    {row.workOrderNumber} · {row.title}
                    {row.legacyWorkOrderId ? ` · legacy ${row.legacyWorkOrderId}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {comparison.matched.some((pair) => pair.mismatches.length > 0) && (
            <section>
              <h3 className="font-semibold text-cyan-200">Field mismatches</h3>
              <ul className="mt-2 space-y-2 text-xs text-slate-300">
                {comparison.matched
                  .filter((pair) => pair.mismatches.length > 0)
                  .map((pair) => (
                    <li key={`${pair.browser.id}-${pair.server.id}`} className="rounded-lg bg-slate-950/60 p-2">
                      <span className="font-semibold">{pair.browser.workOrderNumber}</span>
                      {pair.mismatches.map((mismatch) => (
                        <span key={mismatch.field} className="mt-1 block text-amber-200">
                          {mismatch.field}: browser {mismatch.browserValue} · server {mismatch.serverValue}
                        </span>
                      ))}
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </MatrixCard>
  );
}
