"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FIELD_RELEASE_APPROVE_CONFIRMATION,
  FIELD_RELEASE_HOLD_CONFIRMATION,
  FIELD_RELEASE_REVOKE_CONFIRMATION,
  type FieldReleaseDecisionAuditEntry,
  type FieldReleaseDecisionRecord,
} from "@/lib/field/field-release-decision";
import type { FieldReleaseReadinessSummary } from "@/lib/field/field-release-readiness";

export default function FieldReleaseReadinessCard() {
  const [readiness, setReadiness] = useState<FieldReleaseReadinessSummary | null>(null);
  const [latestDecision, setLatestDecision] = useState<FieldReleaseDecisionRecord | null>(null);
  const [recentDecisions, setRecentDecisions] = useState<FieldReleaseDecisionAuditEntry[]>([]);
  const [notice, setNotice] = useState("Loading Field release readiness…");
  const [decisionNote, setDecisionNote] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setNotice("Loading Field release readiness…");
    try {
      const response = await fetch("/api/field/release-readiness", { cache: "no-store" });
      const body = (await response.json()) as {
        readiness?: FieldReleaseReadinessSummary;
        latestDecision?: FieldReleaseDecisionRecord;
        recentDecisions?: FieldReleaseDecisionAuditEntry[];
        error?: string;
      };
      if (!response.ok || !body.readiness) {
        throw new Error(body.error ?? "Could not load Field release readiness.");
      }
      setReadiness(body.readiness);
      setLatestDecision(body.latestDecision ?? null);
      setRecentDecisions(body.recentDecisions ?? []);
      setNotice("");
    } catch (error) {
      setReadiness(null);
      setNotice(
        error instanceof Error ? error.message : "Could not load Field release readiness.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitDecision(decision: "approve" | "hold" | "revoke") {
    if (acting) return;
    const confirmation =
      decision === "approve"
        ? FIELD_RELEASE_APPROVE_CONFIRMATION
        : decision === "hold"
          ? FIELD_RELEASE_HOLD_CONFIRMATION
          : FIELD_RELEASE_REVOKE_CONFIRMATION;
    const confirmed = window.confirm(confirmation);
    if (!confirmed) return;

    setActing(true);
    try {
      const response = await fetch("/api/field/release-decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          note: decisionNote.trim() || undefined,
          confirmation,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not record release decision.");
      setNotice(`Field release decision recorded: ${decision}.`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not record release decision.");
    } finally {
      setActing(false);
    }
  }

  const tone =
    readiness?.state === "ready"
      ? "border-emerald-800/60 bg-emerald-950/30"
      : readiness?.state === "blocked"
        ? "border-rose-800/60 bg-rose-950/30"
        : "border-amber-800/60 bg-amber-950/30";

  const decisionTone =
    latestDecision?.status === "approved"
      ? "text-emerald-200"
      : latestDecision?.status === "held"
        ? "text-amber-200"
        : latestDecision?.status === "revoked"
          ? "text-rose-200"
          : "text-slate-400";

  return (
    <section className={`mb-5 rounded-xl border p-4 ${readiness ? tone : "border-slate-700 bg-slate-900"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-100">Field Release Readiness</h2>
          <p className="mt-1 text-xs text-slate-400">
            Patch 51B.2.14–51B.2.15 — verification summary plus audited release decisions. Does not
            change sync, bridge, or office rollout.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-200"
        >
          Refresh
        </button>
      </div>

      {notice && <p className="mt-3 text-sm text-slate-300">{notice}</p>}

      {readiness && (
        <div className="mt-3 text-sm text-slate-200">
          <p className="font-semibold">{readiness.headline}</p>
          <p className="mt-1 text-xs text-slate-400">{readiness.detail}</p>

          {readiness.hasFinalizedRecord && (
            <p className="mt-2 text-xs text-slate-300">
              Tester: <span className="font-semibold">{readiness.testerName}</span>
              {" · "}
              Device: <span className="font-semibold">{readiness.deviceLabel}</span>
              {" · "}
              Test date: <span className="font-semibold">{readiness.testDate}</span>
              {readiness.submittedAt && (
                <>
                  {" · "}
                  Submitted {new Date(readiness.submittedAt).toLocaleString()}
                </>
              )}
            </p>
          )}

          {readiness.failedScenarios.length > 0 && (
            <div className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-xs">
              <p className="font-semibold text-rose-100">Failed scenarios</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-100/90">
                {readiness.failedScenarios.map((scenario) => (
                  <li key={scenario.id}>{scenario.label}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs font-semibold text-slate-300">Latest release decision</p>
            {latestDecision && latestDecision.status !== "none" ? (
              <p className={`mt-1 text-sm font-semibold ${decisionTone}`}>
                {latestDecision.status}
                {latestDecision.occurredAt &&
                  ` · ${new Date(latestDecision.occurredAt).toLocaleString()}`}
                {latestDecision.actorDisplayName && ` · ${latestDecision.actorDisplayName}`}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">No release decision recorded yet.</p>
            )}
            {latestDecision?.message && (
              <p className="mt-1 text-xs text-slate-400">{latestDecision.message}</p>
            )}
          </div>

          <label className="mt-3 block text-xs text-slate-400">
            Decision note (optional)
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              rows={2}
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={acting || readiness.state !== "ready"}
              onClick={() => void submitDecision("approve")}
              className="min-h-10 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              Approve release
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => void submitDecision("hold")}
              className="min-h-10 rounded-lg border border-amber-700 px-3 text-xs font-semibold text-amber-100"
            >
              Hold release
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => void submitDecision("revoke")}
              className="min-h-10 rounded-lg border border-rose-700 px-3 text-xs font-semibold text-rose-100"
            >
              Revoke release
            </button>
          </div>
          {readiness.state !== "ready" && (
            <p className="mt-2 text-[11px] text-slate-500">
              Approve is enabled only when the latest finalized verification is release-ready.
            </p>
          )}

          {recentDecisions.length > 0 && (
            <div className="mt-4 border-t border-slate-800 pt-3">
              <p className="text-xs font-semibold text-slate-300">Recent release decisions</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-400">
                {recentDecisions.map((entry) => (
                  <li key={entry.id} className="rounded-lg bg-slate-950/50 px-2 py-2">
                    <span className="font-semibold text-slate-200">{entry.decision}</span>
                    {" · "}
                    {new Date(entry.occurredAt).toLocaleString()}
                    {entry.readinessState && ` · verification ${entry.readinessState}`}
                    {entry.message && ` — ${entry.message}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="#field-device-verification"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-slate-800 px-4 text-xs font-semibold text-cyan-200 hover:bg-slate-700"
          >
            Open device verification checklist
          </Link>
        </div>
      )}
    </section>
  );
}
