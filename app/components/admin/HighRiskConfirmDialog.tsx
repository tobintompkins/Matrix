"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { MatrixButton } from "@/app/components/ui";

type Props = {
  open: boolean;
  title: string;
  summary: string;
  currentValue?: string;
  proposedValue?: string;
  requireReason?: boolean;
  confirmPhrase?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  children?: ReactNode;
};

/** Reusable high-risk confirmation dialog for administration actions. */
export default function HighRiskConfirmDialog({
  open,
  title,
  summary,
  currentValue,
  proposedValue,
  requireReason = true,
  confirmPhrase,
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  children,
}: Props) {
  const titleId = useId();
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason("");
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const phraseOk = !confirmPhrase || typed.trim() === confirmPhrase;
  const reasonOk = !requireReason || reason.trim().length >= 3;
  const canSubmit = phraseOk && reasonOk && !busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm text-amber-200" role="alert">
          High-risk action — review carefully before continuing.
        </p>
        <p className="mt-3 text-sm text-slate-300">{summary}</p>
        {(currentValue || proposedValue) && (
          <dl className="mt-3 space-y-1 text-sm">
            {currentValue ? (
              <div>
                <dt className="text-slate-500">Current</dt>
                <dd className="text-slate-200">{currentValue}</dd>
              </div>
            ) : null}
            {proposedValue ? (
              <div>
                <dt className="text-slate-500">Proposed</dt>
                <dd className="text-slate-200">{proposedValue}</dd>
              </div>
            ) : null}
          </dl>
        )}
        {children}
        {requireReason ? (
          <label className="mt-4 block text-sm text-slate-300">
            Reason
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </label>
        ) : null}
        {confirmPhrase ? (
          <label className="mt-3 block text-sm text-slate-300">
            Type <span className="font-mono text-cyan-300">{confirmPhrase}</span>{" "}
            to confirm
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </label>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <MatrixButton
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </MatrixButton>
          <MatrixButton
            type="button"
            variant="primary"
            disabled={!canSubmit}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </MatrixButton>
        </div>
      </div>
    </div>
  );
}
