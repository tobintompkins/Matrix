"use client";

import { useCallback, useEffect, useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import { OFFICE_DISPATCHER_GROUP_REVOKE_CONFIRMATION } from "@/lib/work-orders/office-dispatcher-group";
import type { OfficeDispatcherSignoffAuditEntry } from "@/lib/work-orders/office-dispatcher-signoff";
import type { OfficeRolloutStatus } from "@/lib/work-orders/office-rollout-status";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../components/ui";

function accessModeLabel(mode: OfficeRolloutStatus["userAccessMode"]): string {
  switch (mode) {
    case "server-pilot-manager":
      return "Server queue · pilot manager";
    case "server-dispatcher-allowlist":
      return "Server queue · dispatcher allowlist";
    case "server-role-allowlist":
      return "Server queue · approved Matrix role";
    case "browser-default":
      return "Browser queue · default";
    default:
      return "Browser queue · fallback";
  }
}

export default function WorkOrdersOfficeDispatcherGroupCard() {
  const canManage = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<OfficeRolloutStatus | null>(null);
  const [audits, setAudits] = useState<OfficeDispatcherSignoffAuditEntry[]>([]);
  const [note, setNote] = useState("");

  const loadMonitoring = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-dispatcher/monitoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        rolloutStatus?: OfficeRolloutStatus;
        dispatcherSignoffAudits?: OfficeDispatcherSignoffAuditEntry[];
        error?: string;
      };
      if (!response.ok || !body.rolloutStatus) {
        throw new Error(body.error ?? "Could not load dispatcher group monitoring.");
      }
      setStatus(body.rolloutStatus);
      setAudits(body.dispatcherSignoffAudits ?? []);
    } catch (monitorError) {
      setError(
        monitorError instanceof Error ? monitorError.message : "Could not load dispatcher group monitoring.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void loadMonitoring();
  }, [canManage, loadMonitoring]);

  async function submitSignoff(decision: "approve" | "deny" | "revoke") {
    if (acting) return;
    const confirmed = window.confirm(
      decision === "revoke"
        ? OFFICE_DISPATCHER_GROUP_REVOKE_CONFIRMATION
        : `Record dispatcher group ${decision}? This action is audited.`,
    );
    if (!confirmed) return;

    setActing(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-dispatcher/signoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          browserWorkOrders,
          note: note.trim() || undefined,
          confirmation: "OFFICE_DISPATCHER_GROUP_SIGNOFF",
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not record dispatcher group sign-off.");
      await loadMonitoring();
    } catch (signoffError) {
      setError(
        signoffError instanceof Error ? signoffError.message : "Could not record dispatcher group sign-off.",
      );
    } finally {
      setActing(false);
    }
  }

  if (!canManage) return null;

  return (
    <MatrixCard
      title="Dispatcher Group Office Server Queue Rollout"
      subtitle="Step 10 — allowlisted dispatchers only. Requires approved pilot manager sign-off and rollout guard."
    >
      <div className="flex flex-wrap items-center gap-3">
        <MatrixButton variant="secondary" size="sm" disabled={loading} onClick={() => void loadMonitoring()}>
          {loading ? "Refreshing…" : "Refresh Group Monitoring"}
        </MatrixButton>
        <MatrixButton
          variant="secondary"
          size="sm"
          disabled={acting || loading || status?.dispatcherGroupSignoffStatus === "revoked"}
          onClick={() => void submitSignoff("revoke")}
        >
          Revoke Group Access
        </MatrixButton>
      </div>

      <label className="mt-4 block text-xs text-slate-400">
        Optional group sign-off note
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <MatrixButton
          variant="primary"
          size="sm"
          disabled={
            acting ||
            !status?.officeFlagEnabled ||
            !status.guard.readyToEnableOfficeFlag ||
            status.pilotSignoffStatus !== "approved" ||
            status.dispatcherAllowlist.length === 0
          }
          onClick={() => void submitSignoff("approve")}
        >
          Approve Dispatcher Group
        </MatrixButton>
        <MatrixButton variant="secondary" size="sm" disabled={acting} onClick={() => void submitSignoff("deny")}>
          Deny Group
        </MatrixButton>
      </div>

      {error && (
        <MatrixEmptyState
          title="Dispatcher group action failed"
          description={error}
          actionLabel="Retry"
          onAction={() => void loadMonitoring()}
          className="mt-4 py-10"
        />
      )}

      {status && (
        <div className="mt-4 space-y-3 text-sm">
          <p
            role="status"
            className={
              status.dispatcherServerQueueEnabled
                ? "rounded-lg border border-cyan-800/50 bg-cyan-950/30 px-3 py-2 font-semibold text-cyan-200"
                : "rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 font-semibold text-amber-200"
            }
          >
            {accessModeLabel(status.userAccessMode)}
          </p>

          <p className="text-xs text-slate-300">
            Pilot manager: <span className="font-semibold">{status.pilotManager ?? "not configured"}</span>
            {" · "}
            Pilot sign-off: <span className="font-semibold">{status.pilotSignoffStatus}</span>
            {" · "}
            Group sign-off: <span className="font-semibold">{status.dispatcherGroupSignoffStatus}</span>
            {" · "}
            Guard:{" "}
            <span className="font-semibold">
              {status.guard.readyToEnableOfficeFlag ? "ready" : "blocked"}
            </span>
          </p>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">Approved allowlist ({status.dispatcherAllowlist.length})</p>
            {status.dispatcherAllowlist.length === 0 ? (
              <p className="mt-1">Configure MATRIX_SERVER_OFFICE_DISPATCHER_ALLOWLIST.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {status.dispatcherAllowlist.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            )}
            <p className="mt-2">
              You are on allowlist:{" "}
              <span className="font-semibold">{status.isOnDispatcherAllowlist ? "yes" : "no"}</span>
            </p>
          </div>

          {status.effectiveRollout.blockedReasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-200">
              {status.effectiveRollout.blockedReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}

          {audits.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Group sign-off audit trail</p>
              <ul className="mt-2 space-y-2">
                {audits.map((entry) => (
                  <li key={entry.id} className="border-t border-slate-800/80 pt-2 first:border-t-0 first:pt-0">
                    <span className="font-semibold">{entry.action}</span> · {entry.occurredAt}
                    {entry.message ? ` — ${entry.message}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </MatrixCard>
  );
}
