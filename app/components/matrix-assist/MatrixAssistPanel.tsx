"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MatrixButton, MatrixCard } from "@/app/components/ui";
import type {
  DiagnosticResponse,
  PartSuggestion,
  ServiceHistorySummary,
  ServiceNotesDraft,
  StepResult,
} from "@/lib/matrix-assist/types";

type AssistStatus = {
  enabled: boolean;
  configured: boolean;
  sampleMode: boolean;
  message: string | null;
  disclaimer: string;
  subtitle: string;
  canUse: boolean;
  permissionDenied: boolean;
};

type SessionStep = {
  id: string;
  stepOrder: number;
  title: string;
  instructions: string | null;
  result: string;
  technicianNote: string | null;
};

type Props = {
  serviceCallId?: string;
  machineId?: string;
  defaultSymptom?: string;
  /** Optional default model for Standalone Mode */
  defaultModel?: string;
  compact?: boolean;
  onDraftNotesReady?: (draft: string) => void;
};

const SUGGESTED_PROMPTS = [
  "Help me diagnose this issue",
  "Summarize this machine’s recent service history",
  "What should I inspect first?",
  "Create a troubleshooting checklist",
  "Suggest likely parts involved",
  "Help write my service notes",
  "What similar repairs were previously completed?",
];

const STEP_RESULTS: StepResult[] = [
  "NOT_STARTED",
  "PASSED",
  "FAILED",
  "NOT_APPLICABLE",
];

export default function MatrixAssistPanel({
  serviceCallId,
  machineId,
  defaultSymptom = "",
  defaultModel = "",
  compact = false,
  onDraftNotesReady,
}: Props) {
  const [status, setStatus] = useState<AssistStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [model, setModel] = useState(defaultModel);
  const [symptom, setSymptom] = useState(defaultSymptom);
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [guidance, setGuidance] = useState<DiagnosticResponse | null>(null);
  const [steps, setSteps] = useState<SessionStep[]>([]);
  const [parts, setParts] = useState<PartSuggestion[]>([]);
  const [history, setHistory] = useState<ServiceHistorySummary | null>(null);
  const [draft, setDraft] = useState<ServiceNotesDraft | null>(null);
  const [conclusion, setConclusion] = useState("");
  const [messageId, setMessageId] = useState<string | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [workflowStep, setWorkflowStep] = useState(1);
  const [linkedServiceCallId, setLinkedServiceCallId] = useState<string | null>(
    null,
  );
  const [linkedMachineId, setLinkedMachineId] = useState<string | null>(null);
  const [assistMode, setAssistMode] = useState<"linked" | "standalone" | null>(
    null,
  );

  const effectiveCallId = linkedServiceCallId || null;
  const effectiveMachineId = linkedMachineId || machineId || null;
  const isStandalone =
    assistMode === "standalone" ||
    (!effectiveCallId && !effectiveMachineId && !serviceCallId && !machineId);

  const contextLabel = effectiveCallId
    ? `Assisting with Service Call ${effectiveCallId}`
    : effectiveMachineId
      ? `Assisting with Machine ${effectiveMachineId}`
      : "Standalone Mode — enter model, symptom, and notes";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/matrix-assist/status", {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setStatusError(data.error ?? "Unable to load Matrix Assist status.");
          return;
        }
        setStatus(data as AssistStatus);
      } catch {
        if (!cancelled) {
          setStatusError(
            "Matrix Assist is temporarily unavailable. You can continue using the standard service workflow.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;
    const standaloneReady = Boolean(model.trim() || symptom.trim());
    if (!serviceCallId && !machineId && !standaloneReady) {
      throw new Error(
        "Enter a machine model and symptom for Standalone Mode, or link a service call / machine.",
      );
    }
    const res = await fetch("/api/matrix-assist/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceCallId,
        machineId,
        reportedSymptom: symptom,
        technicianObservations: observations,
        modelHint: model.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Unable to create diagnostic session.");
    }
    setSessionId(data.session.id);
    const ctx = data.context as {
      serviceCallId?: string;
      machineId?: string;
      printerModel?: string;
    } | null;
    if (ctx?.serviceCallId) setLinkedServiceCallId(ctx.serviceCallId);
    if (ctx?.machineId) setLinkedMachineId(ctx.machineId);
    if (ctx?.printerModel && !model.trim()) setModel(ctx.printerModel);
    setAssistMode(
      data.mode === "standalone" || (!ctx?.serviceCallId && !ctx?.machineId)
        ? "standalone"
        : "linked",
    );
    return data.session.id as string;
  }, [sessionId, serviceCallId, machineId, symptom, observations, model]);

  async function runGuidance(prompt?: string) {
    setError("");
    setLoading("Preparing troubleshooting guidance…");
    try {
      const id = await ensureSession();
      const res = await fetch(`/api/matrix-assist/sessions/${id}/guidance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptom: prompt || symptom,
          observations,
          symptomCategory: inferCategory(prompt || symptom),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to generate guidance.");
      }
      setGuidance(data.guidance);
      setSteps(data.steps ?? []);
      setParts(data.parts ?? []);
      setMessageId(data.messageId ?? null);
      setWorkflowStep(4);
      if (!symptom && prompt) setSymptom(prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate guidance.");
    } finally {
      setLoading("");
    }
  }

  async function runHistorySummary() {
    setError("");
    setLoading("Reviewing machine and service history…");
    try {
      // Soft-handle: history needs a linked call/machine; otherwise show guidance, not an error
      if (
        assistMode === "standalone" ||
        (!serviceCallId && !machineId && !linkedServiceCallId && !linkedMachineId)
      ) {
        setHistory({
          bullets: [
            "Service history is available when Matrix Assist is linked to a valid service call or machine.",
          ],
          evidence: [],
          isSample: true,
        });
        return;
      }
      const id = await ensureSession();
      const res = await fetch(
        `/api/matrix-assist/sessions/${id}/history-summary`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to summarize history.");
      }
      setHistory(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to summarize history.");
    } finally {
      setLoading("");
    }
  }

  async function runDraftNotes() {
    setError("");
    setLoading("Preparing service-note draft…");
    try {
      const id = await ensureSession();
      const res = await fetch(`/api/matrix-assist/sessions/${id}/draft-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerComplaint: symptom,
          inspection: observations,
          finalResult: conclusion,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to draft notes.");
      }
      setDraft(data.draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to draft notes.");
    } finally {
      setLoading("");
    }
  }

  async function updateStep(stepId: string, result: StepResult) {
    if (!sessionId) return;
    const res = await fetch(`/api/matrix-assist/sessions/${sessionId}/steps`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, result }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, result } : s)),
      );
    }
  }

  async function completeSession() {
    if (!sessionId) return;
    setLoading("Saving technician conclusion…");
    try {
      const res = await fetch(`/api/matrix-assist/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          technicianConclusion: conclusion,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to complete session.");
      }
      setWorkflowStep(6);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete session.");
    } finally {
      setLoading("");
    }
  }

  async function submitFeedback(rating: string) {
    if (!sessionId) return;
    const res = await fetch(`/api/matrix-assist/sessions/${sessionId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, messageId }),
    });
    if (res.ok) setFeedbackSaved(true);
  }

  if (statusError) {
    return (
      <MatrixCard title="Matrix Assist" subtitle="Unavailable">
        <p className="text-sm text-amber-200" role="alert">
          {statusError}
        </p>
      </MatrixCard>
    );
  }

  if (!status) {
    return (
      <MatrixCard title="Matrix Assist">
        <p className="text-sm text-slate-400" aria-live="polite">
          Loading Matrix Assist…
        </p>
      </MatrixCard>
    );
  }

  if (status.permissionDenied || !status.canUse) {
    return (
      <MatrixCard title="Matrix Assist" subtitle={status.subtitle}>
        <p className="text-sm text-rose-200" role="alert">
          {status.permissionDenied
            ? "You do not have permission to use Matrix Assist for this record."
            : status.message ??
              "Matrix Assist is disabled in this environment."}
        </p>
      </MatrixCard>
    );
  }

  if (!status.configured) {
    return (
      <MatrixCard title="Matrix Assist" subtitle={status.subtitle}>
        <p className="text-sm text-amber-200" role="status">
          {status.message ??
            "Matrix Assist is not configured in this environment."}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Set AI_ASSIST_ENABLED and AI_API_KEY, or AI_ASSIST_DEV_SAMPLE=true for
          local sample guidance.
        </p>
      </MatrixCard>
    );
  }

  return (
    <section
      aria-label="Matrix Assist"
      className={`space-y-4 ${compact ? "" : ""}`}
    >
      <MatrixCard
        title="Matrix Assist"
        subtitle={status.subtitle}
        actions={
          effectiveCallId ? (
            <Link
              href={`/service-calls/${effectiveCallId}`}
              className="text-sm text-cyan-400 hover:underline"
            >
              Back to service call
            </Link>
          ) : null
        }
      >
        <p className="text-xs font-medium text-cyan-300/90">{contextLabel}</p>
        {isStandalone ? (
          <p className="mt-1 text-xs text-slate-400">
            No active service call linked. Run troubleshooting using the model,
            symptom, and notes below.
          </p>
        ) : null}
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {status.disclaimer}
        </p>
        {status.sampleMode ? (
          <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            Development sample guidance is active — not live AI.
          </p>
        ) : null}

        <label className="mt-4 block text-sm text-slate-300">
          Machine model
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100"
            placeholder="e.g. GD9630, ComColor GD, Valezus"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            maxLength={200}
          />
        </label>
        <label className="mt-3 block text-sm text-slate-300">
          Symptom / observation
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100"
            placeholder="Describe the symptom, error, noise, print-quality issue, jam location, or technician observation."
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            maxLength={4000}
          />
        </label>
        <label className="mt-3 block text-sm text-slate-300">
          Additional notes
          <textarea
            className="mt-1 min-h-16 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            maxLength={4000}
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="min-h-10 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
              onClick={() => {
                if (prompt.toLowerCase().includes("history")) {
                  void runHistorySummary();
                } else if (prompt.toLowerCase().includes("service notes")) {
                  void runDraftNotes();
                } else {
                  void runGuidance(prompt === "Help me diagnose this issue" ? symptom || prompt : `${symptom || defaultSymptom}. ${prompt}`);
                }
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 border-t border-slate-800 bg-slate-900/95 py-3 backdrop-blur">
          <MatrixButton
            type="button"
            variant="primary"
            size="md"
            className="min-h-11"
            onClick={() => void runGuidance()}
            disabled={Boolean(loading)}
          >
            Start guided diagnostics
          </MatrixButton>
          <MatrixButton
            type="button"
            variant="secondary"
            size="md"
            className="min-h-11"
            onClick={() => void runHistorySummary()}
            disabled={Boolean(loading)}
          >
            Summarize history
          </MatrixButton>
          <MatrixButton
            type="button"
            variant="secondary"
            size="md"
            className="min-h-11"
            onClick={() => void runDraftNotes()}
            disabled={Boolean(loading)}
          >
            Draft service notes
          </MatrixButton>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-cyan-300" aria-live="polite">
            {loading}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        {!guidance && !history && !draft && !loading && !error ? (
          <p className="mt-3 text-sm text-slate-500">
            Describe the issue to begin a guided diagnostic session.
          </p>
        ) : null}
      </MatrixCard>

      {history ? (
        <MatrixCard title="Service History Summary">
          {history.isSample ? (
            <p className="mb-2 text-xs text-amber-200">
              Development sample / record-backed summary — no invented events.
            </p>
          ) : null}
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {history.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          {history.evidence.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Based on
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {history.evidence.map((e) => (
                  <li key={e.label}>
                    {e.href ? (
                      <Link href={e.href} className="text-cyan-400 hover:underline">
                        {e.label}
                      </Link>
                    ) : (
                      <span className="text-slate-300">{e.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </MatrixCard>
      ) : null}

      {guidance ? (
        <>
          <MatrixCard title="Step 1 — Confirm the symptom">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
              {guidance.symptomConfirmation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </MatrixCard>

          <MatrixCard title="Step 2 — Safety and preparation">
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">
              {guidance.safetyNotes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </MatrixCard>

          <MatrixCard title="Step 3 — Inspection checklist">
            {guidance.modelSpecificNote ? (
              <p className="mb-3 text-sm text-slate-400">
                {guidance.modelSpecificNote}
              </p>
            ) : null}
            <ul className="space-y-3">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                >
                  <p className="text-sm font-medium text-slate-100">
                    {step.stepOrder}. {step.title}
                  </p>
                  {step.instructions ? (
                    <p className="mt-1 text-xs text-slate-400">
                      {step.instructions}
                    </p>
                  ) : null}
                  <div
                    className="mt-2 flex flex-wrap gap-2"
                    role="group"
                    aria-label={`Result for ${step.title}`}
                  >
                    {STEP_RESULTS.map((result) => (
                      <button
                        key={result}
                        type="button"
                        className={`min-h-10 rounded-md border px-2 py-1 text-xs ${
                          step.result === result
                            ? "border-cyan-500 bg-cyan-500/20 text-cyan-100"
                            : "border-slate-700 text-slate-400"
                        }`}
                        onClick={() => void updateStep(step.id, result)}
                      >
                        {result.replaceAll("_", " ")}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </MatrixCard>

          <MatrixCard title="Step 4 — Likely causes">
            {guidance.isUnverifiedInterpretation ? (
              <p className="mb-2 text-xs font-medium text-amber-200">
                Unverified AI interpretation
              </p>
            ) : null}
            <ul className="space-y-3">
              {guidance.likelyCauses.map((cause) => (
                <li
                  key={cause.title}
                  className="rounded-lg border border-slate-800 px-3 py-2"
                >
                  <p className="text-sm font-medium text-slate-100">
                    Possible cause: {cause.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Confidence: {cause.confidence}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Reason: {cause.reason}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Based on
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {guidance.evidence.map((e) => (
                  <li key={e.label}>
                    {e.href ? (
                      <Link href={e.href} className="text-cyan-400 hover:underline">
                        {e.label}
                      </Link>
                    ) : (
                      e.label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </MatrixCard>

          <MatrixCard title="Step 5 — Recommended next action">
            <ul className="space-y-2 text-sm text-slate-200">
              {guidance.recommendedActions.map((a) => (
                <li key={`${a.type}-${a.detail}`}>
                  <span className="font-medium text-cyan-300">{a.type}</span>
                  {" — "}
                  {a.detail}
                </li>
              ))}
            </ul>
            {parts.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-200">
                  Suggested parts (advisory only)
                </p>
                <ul className="mt-2 space-y-2">
                  {parts.map((p) => (
                    <li
                      key={p.partNumber}
                      className="rounded-lg border border-slate-800 px-3 py-2 text-sm"
                    >
                      <p className="font-medium text-slate-100">
                        {p.partNumber} — {p.description}
                      </p>
                      {p.assembly ? (
                        <p className="text-xs text-slate-500">
                          Likely assembly: {p.assembly}
                          {p.callout ? ` · Possible callout: ${p.callout}` : ""}
                        </p>
                      ) : null}
                      {p.stockHidden ? (
                        <p className="text-xs text-slate-500">
                          Stock details hidden (no inventory permission).
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Available: {p.available ?? "—"} · Reserved:{" "}
                          {p.reserved ?? "—"}
                          {p.warehouse ? ` · ${p.warehouse}` : ""}
                        </p>
                      )}
                      <Link
                        href="/order-parts"
                        className="mt-1 inline-block text-xs text-cyan-400 hover:underline"
                      >
                        Open parts order (manual)
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </MatrixCard>

          <MatrixCard title="Step 6 — Technician conclusion">
            <p className="mb-2 text-xs text-slate-500">
              AI suggestions must not automatically become the official
              diagnosis. Enter your conclusion below.
            </p>
            <textarea
              className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              placeholder="Technician conclusion"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <MatrixButton
                type="button"
                variant="primary"
                size="md"
                onClick={() => void completeSession()}
              >
                Save conclusion
              </MatrixButton>
            </div>
            {workflowStep >= 6 ? (
              <p className="mt-2 text-sm text-emerald-300">
                Diagnostic session saved. The service call was not closed.
              </p>
            ) : null}
          </MatrixCard>
        </>
      ) : null}

      {draft ? (
        <MatrixCard title="Service-note draft">
          <p className="mb-2 text-xs font-medium text-amber-200">
            {draft.label}
          </p>
          <div className="space-y-3 text-sm text-slate-200">
            {draft.sections.map((s) => (
              <div key={s.heading}>
                <p className="font-semibold text-slate-100">{s.heading}</p>
                <p className="whitespace-pre-wrap text-slate-300">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {onDraftNotesReady ? (
              <MatrixButton
                type="button"
                variant="primary"
                size="md"
                onClick={() => onDraftNotesReady(draft.fullText)}
              >
                Use draft in service call
              </MatrixButton>
            ) : null}
            <MatrixButton
              type="button"
              variant="secondary"
              size="md"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(draft.fullText);
                } catch {
                  /* ignore */
                }
              }}
            >
              Copy draft text
            </MatrixButton>
          </div>
        </MatrixCard>
      ) : null}

      {(guidance || history || draft) && !feedbackSaved ? (
        <MatrixCard title="Was this helpful?">
          <div className="flex flex-wrap gap-2">
            {[
              ["HELPFUL", "Helpful"],
              ["PARTIALLY_HELPFUL", "Partially Helpful"],
              ["NOT_HELPFUL", "Not Helpful"],
            ].map(([value, label]) => (
              <MatrixButton
                key={value}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void submitFeedback(value)}
              >
                {label}
              </MatrixButton>
            ))}
          </div>
        </MatrixCard>
      ) : null}
      {feedbackSaved ? (
        <p className="text-sm text-slate-400">Thanks for the feedback.</p>
      ) : null}
    </section>
  );
}

function inferCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  if (t.includes("jam")) return "Paper Jam";
  if (t.includes("feed") || t.includes("misfeed")) return "Paper Feed";
  if (t.includes("quality") || t.includes("streak") || t.includes("density")) {
    return "Print Quality";
  }
  if (t.includes("error") || /e\d+/i.test(text)) return "Error Code";
  if (t.includes("noise") || t.includes("vibration")) return "Noise";
  return undefined;
}
