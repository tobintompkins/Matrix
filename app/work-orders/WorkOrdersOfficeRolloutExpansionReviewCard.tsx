"use client";

import { useCallback, useEffect, useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import {
  OFFICE_EXPANSION_HOLD_CONFIRMATION,
  OFFICE_EXPANSION_REVIEW_APPROVE_CONFIRMATION,
  OFFICE_EXPANSION_REVOKE_CONFIRMATION,
  type OfficeRolloutExpansionReviewSummary,
} from "@/lib/work-orders/office-rollout-expansion-review";
import type { OfficeRolloutStatus } from "@/lib/work-orders/office-rollout-status";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../components/ui";

type RolloutAuditRow = {
  id: string;
  action: string;
  entityType: string;
  occurredAt: string;
  message: string | null;
};

export default function WorkOrdersOfficeRolloutExpansionReviewCard() {
  const canManage = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<OfficeRolloutExpansionReviewSummary | null>(null);
  const [rolloutStatus, setRolloutStatus] = useState<OfficeRolloutStatus | null>(null);
  const [recentRolloutAudits, setRecentRolloutAudits] = useState<RolloutAuditRow[]>([]);
  const [note, setNote] = useState("");

  const loadReview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-rollout/expansion-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders }),
      });
      const body = (await response.json()) as {
        summary?: OfficeRolloutExpansionReviewSummary;
        rolloutStatus?: OfficeRolloutStatus;
        recentRolloutAudits?: RolloutAuditRow[];
        error?: string;
      };
      if (!response.ok || !body.summary) {
        throw new Error(body.error ?? "Could not load expansion review.");
      }
      setSummary(body.summary);
      setRolloutStatus(body.rolloutStatus ?? null);
      setRecentRolloutAudits(body.recentRolloutAudits ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load expansion review.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    void loadReview();
  }, [canManage, loadReview]);

  async function submitDecision(decision: "approve" | "hold" | "revoke") {
    if (acting) return;
    const confirmation =
      decision === "approve"
        ? OFFICE_EXPANSION_REVIEW_APPROVE_CONFIRMATION
        : decision === "hold"
          ? OFFICE_EXPANSION_HOLD_CONFIRMATION
          : OFFICE_EXPANSION_REVOKE_CONFIRMATION;
    const confirmed = window.confirm(confirmation);
    if (!confirmed) return;

    setActing(true);
    setError("");
    try {
      const browserWorkOrders = listWorkOrders();
      const response = await fetch("/api/work-orders/server-office-rollout/expansion-review/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          browserWorkOrders,
          note: note.trim() || undefined,
          confirmation,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not record expansion review decision.");
      await loadReview();
    } catch (decisionError) {
      setError(
        decisionError instanceof Error ? decisionError.message : "Could not record expansion review decision.",
      );
    } finally {
      setActing(false);
    }
  }

  if (!canManage) return null;

  return (
    <MatrixCard
      title="Office Rollout Expansion Review"
      subtitle="Step 12 — manager-reviewed approval before expanding beyond the configured role allowlist."
    >
      <div className="flex flex-wrap items-center gap-3">
        <MatrixButton variant="secondary" size="sm" disabled={loading} onClick={() => void loadReview()}>
          {loading ? "Refreshing…" : "Refresh Expansion Review"}
        </MatrixButton>
        <MatrixButton
          variant="secondary"
          size="sm"
          disabled={acting || loading}
          onClick={() => void submitDecision("hold")}
        >
          Hold Expansion
        </MatrixButton>
        <MatrixButton
          variant="secondary"
          size="sm"
          disabled={acting || loading}
          onClick={() => void submitDecision("revoke")}
        >
          Revoke Expansion
        </MatrixButton>
      </div>

      <label className="mt-4 block text-xs text-slate-400">
        Optional review note
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
          disabled={acting || loading || !summary?.readyForManagerReview}
          onClick={() => void submitDecision("approve")}
        >
          Approve Expansion Review
        </MatrixButton>
      </div>

      {error && (
        <MatrixEmptyState
          title="Expansion review action failed"
          description={error}
          actionLabel="Retry"
          onAction={() => void loadReview()}
          className="mt-4 py-10"
        />
      )}

      {summary && (
        <div className="mt-4 space-y-3 text-sm">
          <p role="status" className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-slate-200">
            <span className="font-semibold">Expansion review:</span> {summary.expansionReviewStatus}
            {" · "}
            <span className="font-semibold">Beyond-role flag:</span>{" "}
            {summary.expansionBeyondRolesFlagEnabled ? "enabled" : "disabled (default)"}
          </p>

          {rolloutStatus && (
            <p className="text-xs text-slate-300">
              Your queue:{" "}
              <span className="font-semibold">
                {rolloutStatus.effectiveRollout.source === "server" ? "Server" : "Browser"}
              </span>
              {" · "}
              {rolloutStatus.effectiveQueueReason}
            </p>
          )}

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">Pilot · dispatcher · role expansion</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Pilot manager: {summary.pilot.manager ?? "not configured"} — sign-off{" "}
                <span className="font-semibold">{summary.pilot.signoffStatus}</span>
              </li>
              <li>
                Dispatcher allowlist: {summary.dispatcher.allowlistCount} identities — sign-off{" "}
                <span className="font-semibold">{summary.dispatcher.signoffStatus}</span>
              </li>
              <li>
                Role allowlist: {summary.roleExpansion.allowlist.join(", ") || "not configured"} — sign-off{" "}
                <span className="font-semibold">{summary.roleExpansion.signoffStatus}</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">Browser / server comparison health</p>
            <p className="mt-1">
              Guard ready:{" "}
              <span className="font-semibold">
                {summary.comparisonHealth.readyForOfficeFlag ? "yes" : "no"}
              </span>
              {" · "}
              Browser {summary.comparisonHealth.browserCount} / server {summary.comparisonHealth.serverCount}
              {" · "}
              Mismatches {summary.comparisonHealth.mismatchCount}
            </p>
          </div>

          {summary.reviewBlockers.length > 0 && (
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
              <p className="font-semibold">Approval blockers</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {summary.reviewBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}

          {recentRolloutAudits.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Recent rollout audit decisions</p>
              <ul className="mt-2 space-y-2">
                {recentRolloutAudits.map((entry) => (
                  <li key={entry.id} className="border-t border-slate-800/80 pt-2 first:border-t-0 first:pt-0">
                    <span className="font-semibold">{entry.action}</span> · {entry.occurredAt}
                    {entry.message ? ` — ${entry.message}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.recentAudits.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Expansion review audit trail</p>
              <ul className="mt-2 space-y-2">
                {summary.recentAudits.map((entry) => (
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
