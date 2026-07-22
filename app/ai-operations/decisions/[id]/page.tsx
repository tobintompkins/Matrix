"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import MatrixShell from "../../../components/MatrixShell";
import MatrixAuthGuard from "../../../components/MatrixAuthGuard";
import { MatrixButton, MatrixCard } from "../../../components/ui";

type EvidenceFact = {
  label: string;
  value: string | number | boolean | null;
  available: boolean;
};

type Decision = {
  id: string;
  title: string;
  summary: string;
  detailedReasoning: string;
  decisionType: string;
  priority: string;
  status: string;
  confidenceScore: number;
  riskScore: number;
  urgencyScore: number;
  businessImpactScore: number;
  overallDecisionScore: number;
  recommendedAction: string;
  alternativeActions: Array<{ action: string; reason: string }>;
  evidence: {
    facts?: EvidenceFact[];
    ruleMatches?: string[];
    links?: Array<{ label: string; href: string }>;
  };
  aiExplanation: {
    whyItMatters?: string;
    whyRecommended?: string;
    nextStep?: string;
    isSample?: boolean;
  } | null;
  highImpact: boolean;
  machineId: string | null;
  customerId: string | null;
  siteId: string | null;
  serviceCallId: string | null;
  partId: string | null;
  technicianId: string | null;
  assignedToUserId: string | null;
  estimatedDowntimeMinutes: number | null;
  estimatedLaborMinutes: number | null;
  estimatedCost: number | null;
  estimatedCostAvoidance: number | null;
  costsHidden?: boolean;
  slaImpact: string | null;
  rejectionReason: string | null;
  completionNotes: string | null;
};

type HistoryRow = {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorName: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
};

export default function DecisionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canApprove = hasMatrixPermission(role, "APPROVE_DECISIONS");
  const canReview = hasMatrixPermission(role, "REVIEW_DECISIONS");
  const canAssign = hasMatrixPermission(role, "ASSIGN_DECISIONS");
  const canComplete = hasMatrixPermission(role, "COMPLETE_DECISIONS");

  const [decision, setDecision] = useState<Decision | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [advisory, setAdvisory] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [deferredUntil, setDeferredUntil] = useState("");
  const [assignee, setAssignee] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/ai-operations/decisions/${id}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Not found");
      setDecision(json.decision);
      setHistory(json.history ?? []);
      setAdvisory(json.advisory ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function runAction(action: string, body: Record<string, unknown> = {}) {
    setMessage("");
    setError("");
    const res = await fetch(`/api/ai-operations/decisions/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Action failed");
      return;
    }
    setMessage(json.note ?? `${action} recorded.`);
    setDecision(json.decision);
    await load();
  }

  return (
    <MatrixShell title="Decision detail" activePath="/ai-operations/decisions">
      <MatrixAuthGuard requiredPermissions={["VIEW_DECISION_CENTER"]}>
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
          <Link
            href="/ai-operations/decisions"
            className="text-sm text-cyan-300 hover:underline"
          >
            ← Back to Decision Center
          </Link>

          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : !decision ? (
            <p className="text-sm text-rose-200">{error || "Not found"}</p>
          ) : (
            <>
              <header className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {decision.decisionType} · {decision.status}
                </p>
                <h1 className="text-2xl font-semibold text-slate-100">
                  {decision.title}
                </h1>
                <p className="text-sm text-slate-400">{decision.summary}</p>
                {advisory ? (
                  <p className="text-xs text-amber-200/80">{advisory}</p>
                ) : null}
              </header>

              {error ? (
                <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {error}
                </p>
              ) : null}
              {message ? (
                <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  {message}
                </p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <MatrixCard className="space-y-3 p-4">
                  <h2 className="text-sm font-medium text-slate-200">
                    Why this matters
                  </h2>
                  <p className="text-sm text-slate-400">
                    {decision.aiExplanation?.whyItMatters ?? decision.summary}
                  </p>
                  <h2 className="pt-2 text-sm font-medium text-slate-200">
                    Recommended next step
                  </h2>
                  <p className="text-sm text-cyan-200">
                    {decision.aiExplanation?.nextStep ??
                      decision.recommendedAction}
                  </p>
                  {decision.highImpact ? (
                    <p className="text-xs text-amber-300">
                      High-impact: approval records intent only — inventory,
                      customer outreach, and financial changes are not
                      auto-executed.
                    </p>
                  ) : null}
                </MatrixCard>

                <MatrixCard className="space-y-2 p-4">
                  <h2 className="text-sm font-medium text-slate-200">Scores</h2>
                  <ul className="grid grid-cols-2 gap-2 text-sm text-slate-400">
                    <li>Overall: {Math.round(decision.overallDecisionScore)}</li>
                    <li>Risk: {Math.round(decision.riskScore)}</li>
                    <li>Urgency: {Math.round(decision.urgencyScore)}</li>
                    <li>Business: {Math.round(decision.businessImpactScore)}</li>
                    <li>Confidence: {Math.round(decision.confidenceScore)}%</li>
                    <li>Priority: {decision.priority}</li>
                  </ul>
                  <p className="pt-2 text-xs text-slate-500">
                    Est. downtime {decision.estimatedDowntimeMinutes ?? "—"} min
                    · labor {decision.estimatedLaborMinutes ?? "—"} min
                    {decision.costsHidden
                      ? " · costs hidden"
                      : ` · avoid $${decision.estimatedCostAvoidance ?? 0}`}
                  </p>
                  {decision.slaImpact ? (
                    <p className="text-xs text-amber-200">{decision.slaImpact}</p>
                  ) : null}
                </MatrixCard>
              </div>

              <MatrixCard className="space-y-3 p-4">
                <h2 className="text-sm font-medium text-slate-200">
                  Why Matrix recommends this
                </h2>
                <p className="text-sm text-slate-400">
                  {decision.aiExplanation?.whyRecommended ??
                    decision.detailedReasoning}
                </p>
                {decision.aiExplanation?.isSample ? (
                  <p className="text-xs text-slate-500">
                    Explanation mode: local sample / deterministic template
                    (same approach as Matrix Assist when no live AI is
                    configured).
                  </p>
                ) : null}
                <h3 className="pt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Supporting evidence
                </h3>
                <ul className="space-y-1 text-sm">
                  {(decision.evidence.facts ?? []).map((f) => (
                    <li key={f.label} className="text-slate-300">
                      <span className="text-slate-500">{f.label}:</span>{" "}
                      {f.available ? String(f.value) : (
                        <em className="text-slate-500">unavailable</em>
                      )}
                    </li>
                  ))}
                </ul>
                {(decision.evidence.links ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {decision.evidence.links!.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="rounded border border-slate-700 px-2 py-1 text-xs text-cyan-300 hover:underline"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </MatrixCard>

              <MatrixCard className="space-y-2 p-4">
                <h2 className="text-sm font-medium text-slate-200">
                  Alternatives
                </h2>
                <ul className="space-y-2 text-sm text-slate-400">
                  {(decision.alternativeActions ?? []).map((a) => (
                    <li key={a.action}>
                      <strong className="text-slate-300">{a.action}</strong>
                      <div className="text-xs">{a.reason}</div>
                    </li>
                  ))}
                </ul>
                <p className="pt-2 text-xs text-slate-500">
                  Linked: machine {decision.machineId ?? "—"} · customer{" "}
                  {decision.customerId ?? "—"} · site {decision.siteId ?? "—"} ·
                  service call {decision.serviceCallId ?? "—"} · part{" "}
                  {decision.partId ?? "—"} · tech {decision.technicianId ?? "—"}
                </p>
              </MatrixCard>

              <MatrixCard className="space-y-3 p-4">
                <h2 className="text-sm font-medium text-slate-200">
                  Approval controls
                </h2>
                <div className="flex flex-wrap gap-2">
                  {canApprove ? (
                    <MatrixButton
                      type="button"
                      onClick={() => void runAction("approve")}
                    >
                      Approve
                    </MatrixButton>
                  ) : null}
                  {canReview ? (
                    <>
                      <MatrixButton
                        type="button"
                        onClick={() =>
                          void runAction("reject", { reason })
                        }
                      >
                        Reject
                      </MatrixButton>
                      <MatrixButton
                        type="button"
                        onClick={() =>
                          void runAction("defer", {
                            reason,
                            deferredUntil,
                          })
                        }
                      >
                        Defer
                      </MatrixButton>
                    </>
                  ) : null}
                  {canAssign ? (
                    <MatrixButton
                      type="button"
                      onClick={() =>
                        void runAction("assign", {
                          assignedToUserId: assignee || user?.id || "dev-user",
                        })
                      }
                    >
                      Assign
                    </MatrixButton>
                  ) : null}
                  {canComplete ? (
                    <>
                      <MatrixButton
                        type="button"
                        onClick={() => void runAction("start")}
                      >
                        Start
                      </MatrixButton>
                      <MatrixButton
                        type="button"
                        onClick={() =>
                          void runAction("complete", {
                            completionNotes,
                            outcomeUseful: true,
                          })
                        }
                      >
                        Complete
                      </MatrixButton>
                    </>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    placeholder="Reason (reject / defer)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <input
                    type="date"
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    value={deferredUntil}
                    onChange={(e) => setDeferredUntil(e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    placeholder="Assignee user id"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  />
                  <input
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    placeholder="Completion notes"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                  />
                </div>
              </MatrixCard>

              <MatrixCard className="space-y-2 p-4">
                <h2 className="text-sm font-medium text-slate-200">
                  History
                </h2>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500">No history yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-400">
                    {history.map((h) => (
                      <li key={h.id} className="border-t border-slate-800 pt-2">
                        <span className="text-slate-300">{h.action}</span>
                        {h.fromStatus ? ` ${h.fromStatus} → ${h.toStatus}` : ""}
                        <div className="text-xs text-slate-500">
                          {h.actorName ?? "system"} ·{" "}
                          {new Date(h.createdAt).toLocaleString()}
                          {h.reason ? ` · ${h.reason}` : ""}
                          {h.notes ? ` · ${h.notes}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </MatrixCard>
            </>
          )}
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
