"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEVICE_VERIFICATION_CHECKS,
  createDefaultFieldDeviceVerificationRecord,
  formatFieldDeviceVerificationExport,
  loadFieldDeviceVerificationFromStorage,
  saveFieldDeviceVerificationToStorage,
  summarizeFieldDeviceVerificationReadiness,
  type DeviceVerificationCheckId,
  type DeviceVerificationStatus,
  type FieldDeviceVerificationRecord,
} from "@/lib/field/device-verification";
import {
  FIELD_DEVICE_VERIFICATION_FINALIZE_CONFIRMATION,
  type FieldDeviceVerificationSubmissionSummary,
} from "@/lib/field/device-verification-submission";

function detectBrowserLabel(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent.slice(0, 160);
}

export default function FieldDeviceVerificationChecklist() {
  const [record, setRecord] = useState<FieldDeviceVerificationRecord>(() =>
    createDefaultFieldDeviceVerificationRecord(),
  );
  const [copyNotice, setCopyNotice] = useState("");
  const [submitNotice, setSubmitNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<FieldDeviceVerificationSubmissionSummary[]>([]);
  const [submissionsNotice, setSubmissionsNotice] = useState("");

  const loadSubmissions = useCallback(async () => {
    try {
      const response = await fetch("/api/field/device-verification?limit=12", { cache: "no-store" });
      const body = (await response.json()) as {
        submissions?: FieldDeviceVerificationSubmissionSummary[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Could not load submitted verification records.");
      setSubmissions(body.submissions ?? []);
      setSubmissionsNotice("");
    } catch (error) {
      setSubmissionsNotice(
        error instanceof Error ? error.message : "Could not load submitted verification records.",
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loaded = loadFieldDeviceVerificationFromStorage(window.localStorage);
    if (!loaded.browserLabel.trim()) {
      loaded.browserLabel = detectBrowserLabel();
    }
    setRecord(loaded);
    void loadSubmissions();
  }, [loadSubmissions]);

  const readiness = useMemo(() => summarizeFieldDeviceVerificationReadiness(record), [record]);

  const persist = useCallback((next: FieldDeviceVerificationRecord) => {
    if (typeof window === "undefined") {
      setRecord(next);
      return;
    }
    setRecord(saveFieldDeviceVerificationToStorage(window.localStorage, next));
  }, []);

  function updateMeta(field: keyof Pick<FieldDeviceVerificationRecord, "testerName" | "deviceLabel" | "browserLabel" | "testDate" | "notes">, value: string) {
    persist({ ...record, [field]: value });
  }

  function setCheckStatus(checkId: DeviceVerificationCheckId, status: DeviceVerificationStatus) {
    persist({
      ...record,
      checks: { ...record.checks, [checkId]: status },
    });
  }

  function resetChecklist() {
    const confirmed = window.confirm(
      "Reset the device verification checklist on this browser? This only clears local manager notes.",
    );
    if (!confirmed) return;
    const fresh = createDefaultFieldDeviceVerificationRecord();
    fresh.browserLabel = detectBrowserLabel();
    persist(fresh);
  }

  const canSubmitFinalized =
    readiness.state === "ready" || readiness.state === "blocked";

  async function submitFinalizedRecord() {
    if (submitting || !canSubmitFinalized) return;
    const confirmed = window.confirm(
      "Submit this finalized Field device verification to the server? The local checklist stays as your working draft.",
    );
    if (!confirmed) return;

    setSubmitting(true);
    setSubmitNotice("");
    try {
      const response = await fetch("/api/field/device-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft: record,
          confirmation: FIELD_DEVICE_VERIFICATION_FINALIZE_CONFIRMATION,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not submit verification record.");
      setSubmitNotice("Finalized verification record submitted.");
      await loadSubmissions();
    } catch (error) {
      setSubmitNotice(
        error instanceof Error ? error.message : "Could not submit verification record.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyReleaseRecord() {
    const text = formatFieldDeviceVerificationExport(record);
    try {
      await navigator.clipboard.writeText(text);
      setCopyNotice("Release record copied to clipboard.");
    } catch {
      setCopyNotice("Could not copy automatically. Use Export text below.");
    }
  }

  const readinessTone =
    readiness.state === "ready"
      ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-100"
      : readiness.state === "blocked"
        ? "border-rose-800/60 bg-rose-950/30 text-rose-100"
        : "border-amber-800/60 bg-amber-950/30 text-amber-100";

  return (
    <section
      id="field-device-verification"
      className="mb-5 scroll-mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Field Device Verification</h2>
          <p className="mt-1 text-xs text-slate-400">
            Local checklist is the working draft (51B.2.12). Optional server submit stores a finalized release record (51B.2.13).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting || !canSubmitFinalized}
            onClick={() => void submitFinalizedRecord()}
            className="min-h-10 rounded-lg bg-cyan-500 px-3 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit finalized record"}
          </button>
          <button
            type="button"
            onClick={() => void copyReleaseRecord()}
            className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold"
          >
            Copy release record
          </button>
          <button
            type="button"
            onClick={() => resetChecklist()}
            className="min-h-10 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-slate-300"
          >
            Reset local checklist
          </button>
        </div>
      </div>

      <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${readinessTone}`} role="status">
        <p className="font-semibold">{readiness.headline}</p>
        <p className="mt-1 text-xs opacity-90">
          {readiness.detail} · {readiness.passed} pass · {readiness.failed} fail ·{" "}
          {readiness.notTested} not tested
        </p>
      </div>

      {copyNotice && <p className="mt-2 text-xs text-cyan-200">{copyNotice}</p>}
      {submitNotice && <p className="mt-2 text-xs text-cyan-200">{submitNotice}</p>}
      {!canSubmitFinalized && (
        <p className="mt-2 text-xs text-slate-500">
          Mark every scenario Pass or Fail before submitting a finalized server record.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-slate-400">
          Tester
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={record.testerName}
            onChange={(event) => updateMeta("testerName", event.target.value)}
            placeholder="Name or initials"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Test date
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={record.testDate}
            onChange={(event) => updateMeta("testDate", event.target.value)}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Device
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={record.deviceLabel}
            onChange={(event) => updateMeta("deviceLabel", event.target.value)}
            placeholder="Phone, tablet, laptop model"
          />
        </label>
        <label className="block text-xs text-slate-400">
          Browser
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={record.browserLabel}
            onChange={(event) => updateMeta("browserLabel", event.target.value)}
            placeholder="Safari, Chrome, Edge…"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs text-slate-400">
        Session notes
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          rows={2}
          value={record.notes}
          onChange={(event) => updateMeta("notes", event.target.value)}
          placeholder="Build, network conditions, blockers…"
        />
      </label>

      <ul className="mt-4 space-y-3">
        {DEVICE_VERIFICATION_CHECKS.map((item) => {
          const status = record.checks[item.id];
          return (
            <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
                </div>
                <div className="flex gap-1" role="group" aria-label={`${item.label} result`}>
                  {(["not-tested", "pass", "fail"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={status === option}
                      onClick={() => setCheckStatus(item.id, option)}
                      className={`min-h-9 rounded-md px-2 text-xs font-semibold ${
                        status === option
                          ? option === "pass"
                            ? "bg-emerald-600 text-white"
                            : option === "fail"
                              ? "bg-rose-600 text-white"
                              : "bg-slate-600 text-white"
                          : "border border-slate-700 text-slate-300"
                      }`}
                    >
                      {option === "not-tested" ? "Not tested" : option === "pass" ? "Pass" : "Fail"}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <details className="mt-4 text-xs text-slate-400">
        <summary className="cursor-pointer font-semibold text-slate-300">Export text preview</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-[11px] text-slate-300">
          {formatFieldDeviceVerificationExport(record)}
        </pre>
      </details>

      <p className="mt-3 text-[11px] text-slate-500">
        Last saved locally: {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "—"}
      </p>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Recent submitted records</h3>
          <button
            type="button"
            onClick={() => void loadSubmissions()}
            className="min-h-9 rounded-lg border border-slate-600 px-3 text-xs font-semibold"
          >
            Refresh
          </button>
        </div>
        {submissionsNotice && <p className="mt-2 text-xs text-rose-200">{submissionsNotice}</p>}
        <ul className="mt-3 space-y-2">
          {submissions.length === 0 && !submissionsNotice && (
            <li className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
              No finalized verification records submitted yet.
            </li>
          )}
          {submissions.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">
                    {entry.testerName} · {entry.deviceLabel}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {entry.testDate} · {entry.browserLabel || "Browser not recorded"} · submitted{" "}
                    {new Date(entry.submittedAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-slate-500">
                    By {entry.submittedByName ?? entry.submittedByUserId} · {entry.passedCount} pass ·{" "}
                    {entry.failedCount} fail
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                    entry.releaseResult === "ready"
                      ? "bg-emerald-500/15 text-emerald-200"
                      : "bg-rose-500/15 text-rose-200"
                  }`}
                >
                  {entry.releaseResult === "ready" ? "Release-ready" : "Blocked"}
                </span>
              </div>
              {entry.notes && <p className="mt-2 text-slate-400">{entry.notes}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
