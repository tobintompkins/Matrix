"use client";

import { useCallback, useEffect, useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import type { OfficeRolloutGuardResult } from "@/lib/work-orders/office-rollout-guard";
import {
  OFFICE_PILOT_REVOKE_CONFIRMATION,
  type OfficePilotMonitoringView,
} from "@/lib/work-orders/office-pilot-monitoring";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../components/ui";

export default function WorkOrdersOfficePilotMonitoringCard() {
  const canManage = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState("");
  const [monitoring, setMonitoring] = useState<OfficePilotMonitoringView | null>(null);
  const [guard, setGuard] = useState<OfficeRolloutGuardResult | null>(null);

  const loadMonitoring = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-pilot/monitoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        monitoring?: OfficePilotMonitoringView;
        guard?: OfficeRolloutGuardResult;
        error?: string;
      };
      if (!response.ok || !body.monitoring) {
        throw new Error(body.error ?? "Could not load pilot monitoring.");
      }
      setMonitoring(body.monitoring);
      setGuard(body.guard ?? null);
    } catch (monitorError) {
      setError(
        monitorError instanceof Error ? monitorError.message : "Could not load pilot monitoring.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void loadMonitoring();
  }, [canManage, loadMonitoring]);

  async function revokePilotAccess() {
    if (revoking) return;
    if (!window.confirm(OFFICE_PILOT_REVOKE_CONFIRMATION)) return;

    setRevoking(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-pilot/signoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "revoke",
          browserWorkOrders,
          note: "Revoked from Office Server Queue Pilot Monitoring (Step 9).",
          confirmation: "OFFICE_PILOT_SIGNOFF",
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not revoke pilot access.");
      }
      await loadMonitoring();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : "Could not revoke pilot access.",
      );
    } finally {
      setRevoking(false);
    }
  }

  if (!canManage) return null;

  return (
    <MatrixCard
      title="Office Server Queue Pilot Monitoring"
      subtitle="Step 9 — read-only operational view for managers. Access stays limited to the named pilot manager."
    >
      <div className="flex flex-wrap items-center gap-3">
        <MatrixButton variant="secondary" size="sm" disabled={loading} onClick={() => void loadMonitoring()}>
          {loading ? "Refreshing…" : "Refresh Monitoring"}
        </MatrixButton>
        <MatrixButton
          variant="secondary"
          size="sm"
          disabled={revoking || loading || monitoring?.latestDecision.status === "revoked"}
          onClick={() => void revokePilotAccess()}
        >
          {revoking ? "Revoking…" : "Revoke Pilot Access"}
        </MatrixButton>
      </div>

      {error && (
        <MatrixEmptyState
          title="Pilot monitoring failed"
          description={error}
          actionLabel="Retry"
          onAction={() => void loadMonitoring()}
          className="mt-4 py-10"
        />
      )}

      {monitoring && (
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <section className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pilot manager</p>
            <p className="mt-1 font-semibold text-slate-100">{monitoring.pilotManager ?? "Not configured"}</p>
            <p className="mt-2 text-xs text-slate-400">
              You are the named pilot manager:{" "}
              <span className="font-semibold text-slate-200">
                {monitoring.isNamedPilotManager ? "Yes" : "No"}
              </span>
            </p>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Office flag</p>
            <p className="mt-1 font-semibold text-slate-100">
              {monitoring.officeFlagEnabled
                ? "MATRIX_SERVER_OFFICE_WORK_ORDERS=true"
                : "false (default)"}
            </p>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest sign-off decision</p>
            <p className="mt-1 font-semibold capitalize text-slate-100">{monitoring.latestDecision.status}</p>
            <p className="mt-1 text-xs text-slate-400">
              {monitoring.latestDecision.occurredAt
                ? `${monitoring.latestDecision.occurredAt}${monitoring.latestDecision.actorDisplayName ? ` · ${monitoring.latestDecision.actorDisplayName}` : ""}`
                : "No audited decision recorded yet."}
            </p>
            {monitoring.latestDecision.message && (
              <p className="mt-1 text-xs text-slate-300">{monitoring.latestDecision.message}</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rollout guard</p>
            <p
              className={
                monitoring.guardSummary.status === "ready"
                  ? "mt-1 font-semibold text-emerald-300"
                  : "mt-1 font-semibold text-amber-300"
              }
            >
              {monitoring.guardSummary.status === "ready" ? "Ready" : "Blocked"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Browser {monitoring.guardSummary.browserCount} · Server {monitoring.guardSummary.serverCount} ·
              Matched {monitoring.guardSummary.matchedCount} · Missing on server{" "}
              {monitoring.guardSummary.missingOnServerCount} · Field mismatches{" "}
              {monitoring.guardSummary.mismatchCount}
            </p>
            {guard && monitoring.guardSummary.reasons.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
                {monitoring.guardSummary.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </section>

          <section
            className={
              monitoring.effectiveQueue.source === "server"
                ? "rounded-lg border border-cyan-800/50 bg-cyan-950/20 px-3 py-3 md:col-span-2"
                : "rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-3 md:col-span-2"
            }
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Effective queue (this user)
            </p>
            <p className="mt-1 font-semibold text-slate-100">{monitoring.effectiveQueue.label}</p>
            <p className="mt-1 text-xs text-slate-300">{monitoring.effectiveQueue.detail}</p>
            {monitoring.effectiveQueue.browserFallbackActive && (
              <p className="mt-2 text-xs text-amber-200">Browser fallback is active for this session.</p>
            )}
          </section>
        </div>
      )}
    </MatrixCard>
  );
}
