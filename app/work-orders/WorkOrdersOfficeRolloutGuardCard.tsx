"use client";

import { useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import type { OfficeRolloutGuardResult } from "@/lib/work-orders/office-rollout-guard";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../components/ui";

export default function WorkOrdersOfficeRolloutGuardCard() {
  const canManage = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guard, setGuard] = useState<OfficeRolloutGuardResult | null>(null);
  const [officeFlagEnabled, setOfficeFlagEnabled] = useState(false);

  if (!canManage) return null;

  async function checkRolloutGuard() {
    setLoading(true);
    setError("");
    setGuard(null);
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-rollout-guard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        guard?: OfficeRolloutGuardResult;
        officeFlagEnabled?: boolean;
        error?: string;
      };
      if (!response.ok || !body.guard) {
        throw new Error(body.error ?? "Could not evaluate office rollout guard.");
      }
      setGuard(body.guard);
      setOfficeFlagEnabled(Boolean(body.officeFlagEnabled));
    } catch (guardError) {
      setError(
        guardError instanceof Error
          ? guardError.message
          : "Could not evaluate office rollout guard.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MatrixCard
      title="Office Server Queue Rollout Guard"
      subtitle="Read-only gate before enabling MATRIX_SERVER_OFFICE_WORK_ORDERS."
    >
      <div className="flex flex-wrap items-center gap-3">
        <MatrixButton variant="secondary" size="sm" disabled={loading} onClick={() => void checkRolloutGuard()}>
          {loading ? "Checking…" : "Check Rollout Readiness"}
        </MatrixButton>
        <span className="text-xs text-slate-400">
          Blocks rollout when browser/server comparison finds missing records or field mismatches. Browser queue remains rollback.
        </span>
      </div>

      {error && (
        <MatrixEmptyState
          title="Rollout guard check failed"
          description={error}
          actionLabel="Retry"
          onAction={() => void checkRolloutGuard()}
          className="mt-4 py-10"
        />
      )}

      {guard && (
        <div className="mt-4 space-y-3 text-sm">
          <p
            role="status"
            className={
              guard.status === "ready"
                ? "rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 font-semibold text-emerald-200"
                : "rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 font-semibold text-rose-200"
            }
          >
            {guard.status === "ready"
              ? "Ready for controlled office server queue rollout"
              : "Rollout blocked — resolve comparison issues first"}
          </p>

          {officeFlagEnabled && (
            <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
              MATRIX_SERVER_OFFICE_WORK_ORDERS is currently enabled. Set it to false and restart the app to return to the browser queue without deleting data.
            </p>
          )}

          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-300">
            {guard.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          <p className="text-xs text-slate-500">
            Browser {guard.summary.browserCount} · Server {guard.summary.serverCount} · Matched{" "}
            {guard.summary.matchedCount} · Missing on server {guard.summary.missingOnServerCount} · Missing in browser{" "}
            {guard.summary.missingOnBrowserCount} · Field mismatches {guard.summary.mismatchCount}
          </p>
        </div>
      )}
    </MatrixCard>
  );
}
