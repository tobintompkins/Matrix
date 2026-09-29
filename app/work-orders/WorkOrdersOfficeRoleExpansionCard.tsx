"use client";

import { useCallback, useEffect, useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import { OFFICE_ROLE_EXPANSION_REVOKE_CONFIRMATION } from "@/lib/work-orders/office-role-expansion";
import type { OfficeRoleExpansionSignoffAuditEntry } from "@/lib/work-orders/office-role-expansion-signoff";
import type { OfficeRolloutStatus } from "@/lib/work-orders/office-rollout-status";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../components/ui";

export default function WorkOrdersOfficeRoleExpansionCard() {
  const canManage = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<OfficeRolloutStatus | null>(null);
  const [audits, setAudits] = useState<OfficeRoleExpansionSignoffAuditEntry[]>([]);
  const [note, setNote] = useState("");

  const loadMonitoring = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-role-expansion/monitoring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        rolloutStatus?: OfficeRolloutStatus;
        roleExpansionSignoffAudits?: OfficeRoleExpansionSignoffAuditEntry[];
        error?: string;
      };
      if (!response.ok || !body.rolloutStatus) {
        throw new Error(body.error ?? "Could not load role expansion monitoring.");
      }
      setStatus(body.rolloutStatus);
      setAudits(body.roleExpansionSignoffAudits ?? []);
    } catch (monitorError) {
      setError(
        monitorError instanceof Error ? monitorError.message : "Could not load role expansion monitoring.",
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
        ? OFFICE_ROLE_EXPANSION_REVOKE_CONFIRMATION
        : `Record office role expansion ${decision}? This action is audited.`,
    );
    if (!confirmed) return;

    setActing(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-role-expansion/signoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          browserWorkOrders,
          note: note.trim() || undefined,
          confirmation: "OFFICE_ROLE_EXPANSION_SIGNOFF",
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not record role expansion sign-off.");
      await loadMonitoring();
    } catch (signoffError) {
      setError(
        signoffError instanceof Error ? signoffError.message : "Could not record role expansion sign-off.",
      );
    } finally {
      setActing(false);
    }
  }

  if (!canManage) return null;

  return (
    <MatrixCard
      title="Office Role Expansion (Server Queue)"
      subtitle="Step 11 — approved Matrix roles only. Requires rollout guard plus pilot and dispatcher guardrails."
    >
      <div className="flex flex-wrap items-center gap-3">
        <MatrixButton variant="secondary" size="sm" disabled={loading} onClick={() => void loadMonitoring()}>
          {loading ? "Refreshing…" : "Refresh Role Monitoring"}
        </MatrixButton>
        <MatrixButton
          variant="secondary"
          size="sm"
          disabled={acting || loading || status?.roleExpansionSignoffStatus === "revoked"}
          onClick={() => void submitSignoff("revoke")}
        >
          Revoke Role Expansion
        </MatrixButton>
      </div>

      <label className="mt-4 block text-xs text-slate-400">
        Optional sign-off note
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
            status.dispatcherGroupSignoffStatus !== "approved" ||
            status.roleAllowlist.length === 0
          }
          onClick={() => void submitSignoff("approve")}
        >
          Approve Role Expansion
        </MatrixButton>
        <MatrixButton variant="secondary" size="sm" disabled={acting} onClick={() => void submitSignoff("deny")}>
          Deny
        </MatrixButton>
      </div>

      {error && (
        <MatrixEmptyState
          title="Role expansion action failed"
          description={error}
          actionLabel="Retry"
          onAction={() => void loadMonitoring()}
          className="mt-4 py-10"
        />
      )}

      {status && (
        <div className="mt-4 space-y-3 text-sm">
          <p role="status" className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-slate-200">
            <span className="font-semibold">Your queue:</span> {status.effectiveRollout.source === "server" ? "Server" : "Browser"}{" "}
            · <span className="font-semibold">Reason:</span> {status.effectiveQueueReason}
          </p>

          <p className="text-xs text-slate-300">
            Your role: <span className="font-semibold">{status.userRole}</span>
            {" · "}
            Role expansion sign-off:{" "}
            <span className="font-semibold">{status.roleExpansionSignoffStatus}</span>
            {" · "}
            Guard:{" "}
            <span className="font-semibold">{status.guard.readyToEnableOfficeFlag ? "ready" : "blocked"}</span>
          </p>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">Approved Matrix roles</p>
            {status.roleAllowlist.length === 0 ? (
              <p className="mt-1">Configure MATRIX_SERVER_OFFICE_ROLE_ALLOWLIST.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {status.roleAllowlist.map((role) => (
                  <li key={role}>{role}</li>
                ))}
              </ul>
            )}
            <p className="mt-2">
              Your role is approved:{" "}
              <span className="font-semibold">{status.isApprovedRole ? "yes" : "no"}</span>
            </p>
          </div>

          {audits.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Role expansion audit trail</p>
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
