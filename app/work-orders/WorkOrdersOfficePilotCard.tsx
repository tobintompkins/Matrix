"use client";

import { useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import type { OfficeRolloutGuardResult } from "@/lib/work-orders/office-rollout-guard";
import type { OfficePilotSignoffAuditEntry } from "@/lib/work-orders/office-pilot-signoff";
import type { OfficePilotStatus } from "@/lib/work-orders/office-pilot-status";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../components/ui";

export default function WorkOrdersOfficePilotCard() {
  const canManage = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [pilot, setPilot] = useState<OfficePilotStatus | null>(null);
  const [guard, setGuard] = useState<OfficeRolloutGuardResult | null>(null);
  const [audits, setAudits] = useState<OfficePilotSignoffAuditEntry[]>([]);
  const [note, setNote] = useState("");

  if (!canManage) return null;

  async function loadPilotStatus() {
    setLoading(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-pilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        pilot?: OfficePilotStatus;
        guard?: OfficeRolloutGuardResult;
        error?: string;
      };
      if (!response.ok || !body.pilot || !body.guard) {
        throw new Error(body.error ?? "Could not load office pilot status.");
      }
      setPilot(body.pilot);
      setGuard(body.guard);
      setAudits(body.pilot.signoffAudits);
    } catch (pilotError) {
      setError(
        pilotError instanceof Error ? pilotError.message : "Could not load office pilot status.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitSignoff(decision: "approve" | "deny" | "revoke") {
    if (acting) return;
    const label =
      decision === "approve"
        ? "approve the one-manager server queue pilot"
        : `${decision} the one-manager server queue pilot`;
    const confirmed = window.confirm(`Record sign-off to ${label}? This action is audited.`);
    if (!confirmed) return;

    setActing(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-pilot/signoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          browserWorkOrders,
          note: note.trim() || undefined,
          confirmation: "OFFICE_PILOT_SIGNOFF",
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not record pilot sign-off.");
      }
      await loadPilotStatus();
    } catch (signoffError) {
      setError(
        signoffError instanceof Error ? signoffError.message : "Could not record pilot sign-off.",
      );
    } finally {
      setActing(false);
    }
  }

  return (
    <MatrixCard
      title="One-Manager Office Server Queue Pilot"
      subtitle="Step 8 — requires a clean rollout guard, named pilot manager, and audited sign-off before server queue access."
    >
      <div className="flex flex-wrap items-center gap-3">
        <MatrixButton variant="secondary" size="sm" disabled={loading} onClick={() => void loadPilotStatus()}>
          {loading ? "Loading…" : "Refresh Pilot Status"}
        </MatrixButton>
        <span className="text-xs text-slate-400">
          Default remains MATRIX_SERVER_OFFICE_WORK_ORDERS=false until operations enable the flag after checks pass.
        </span>
      </div>

      <label className="mt-4 block text-xs text-slate-400">
        Optional sign-off note
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Pilot scope, validation evidence, or rollback contact"
        />
      </label>

      {error && (
        <MatrixEmptyState
          title="Office pilot action failed"
          description={error}
          actionLabel="Retry"
          onAction={() => void loadPilotStatus()}
          className="mt-4 py-10"
        />
      )}

      {pilot && guard && (
        <div className="mt-4 space-y-3 text-sm">
          <p
            role="status"
            className={
              pilot.pilotServerQueueEnabled
                ? "rounded-lg border border-cyan-800/50 bg-cyan-950/30 px-3 py-2 font-semibold text-cyan-200"
                : "rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 font-semibold text-amber-200"
            }
          >
            {pilot.pilotServerQueueEnabled
              ? "Pilot server queue enabled for this manager"
              : "Pilot server queue not enabled for this session"}
          </p>

          <p className="text-xs text-slate-300">
            Office flag:{" "}
            <span className="font-semibold">
              {pilot.officeFlagEnabled ? "MATRIX_SERVER_OFFICE_WORK_ORDERS=true" : "false (default)"}
            </span>
            {" · "}
            Pilot manager:{" "}
            <span className="font-semibold">{pilot.pilotManager ?? "not configured"}</span>
            {" · "}
            Guard:{" "}
            <span className="font-semibold">{guard.readyToEnableOfficeFlag ? "ready" : "blocked"}</span>
            {" · "}
            Sign-off: <span className="font-semibold">{pilot.signoff.status}</span>
            {" · "}
            You are pilot manager:{" "}
            <span className="font-semibold">{pilot.isNamedPilotManager ? "yes" : "no"}</span>
          </p>

          <div className="flex flex-wrap gap-2">
            <MatrixButton
              variant="primary"
              size="sm"
              disabled={acting || !pilot.officeFlagEnabled || !guard.readyToEnableOfficeFlag || !pilot.isNamedPilotManager}
              onClick={() => void submitSignoff("approve")}
            >
              Approve Pilot
            </MatrixButton>
            <MatrixButton variant="secondary" size="sm" disabled={acting} onClick={() => void submitSignoff("deny")}>
              Deny
            </MatrixButton>
            <MatrixButton variant="secondary" size="sm" disabled={acting} onClick={() => void submitSignoff("revoke")}>
              Revoke
            </MatrixButton>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">Rollback instructions</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {pilot.rollbackSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>

          {audits.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Sign-off audit trail</p>
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
