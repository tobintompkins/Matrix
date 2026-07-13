"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MatrixButton } from "@/app/components/ui";

type Props = {
  open: boolean;
  currentCopyCount: number | null;
  previousCopyCount: number | null;
  onClose: () => void;
  onSave: (input: {
    copyCount: number;
    notes: string;
    lowerCountReason?: string;
  }) => void;
};

type FormProps = {
  currentCopyCount: number | null;
  previousCopyCount: number | null;
  onClose: () => void;
  onSave: (input: {
    copyCount: number;
    notes: string;
    lowerCountReason?: string;
  }) => void;
};

function CopyCountEntryForm({
  currentCopyCount,
  previousCopyCount,
  onClose,
  onSave,
}: FormProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copyCount, setCopyCount] = useState(
    currentCopyCount !== null ? String(currentCopyCount) : "",
  );
  const [notes, setNotes] = useState("");
  const [lowerReason, setLowerReason] = useState("");
  const [error, setError] = useState("");

  const parsed = Number(copyCount.replace(/,/g, ""));
  const isLower =
    previousCopyCount !== null &&
    Number.isFinite(parsed) &&
    parsed < previousCopyCount;

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      setError("Enter a non-negative whole number.");
      return;
    }
    if (isLower && !lowerReason.trim()) {
      setError("Provide a reason before saving a lower copy count.");
      return;
    }
    onSave({
      copyCount: parsed,
      notes,
      lowerCountReason: isLower ? lowerReason.trim() : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 id={titleId} className="text-xl font-bold text-white">
            Enter Copy Count
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Updates the current count and recalculates maintenance statuses.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}
          {previousCopyCount !== null && (
            <p className="text-xs text-slate-500">
              Previous recorded count: {previousCopyCount.toLocaleString("en-US")}
            </p>
          )}
          <label className="block text-sm text-slate-300">
            Current Copy Count
            <input
              ref={inputRef}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              value={copyCount}
              onChange={(e) => setCopyCount(e.target.value)}
            />
          </label>
          {isLower && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
              <p className="font-semibold">Lower count warning</p>
              <p className="mt-1 text-amber-200/90">
                The new count is lower than the previous reading. This may be
                valid after a controller replacement or correction — a reason is
                required.
              </p>
              <label className="mt-3 block text-sm text-amber-100">
                Reason for lower count
                <textarea
                  className="mt-1 min-h-[70px] w-full rounded-lg border border-amber-500/30 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  value={lowerReason}
                  onChange={(e) => setLowerReason(e.target.value)}
                  placeholder="Controller replacement, correction, etc."
                />
              </label>
            </div>
          )}
          <label className="block text-sm text-slate-300">
            Notes
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional technician notes…"
            />
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 px-6 py-4">
          <MatrixButton type="button" variant="secondary" size="md" onClick={onClose}>
            Cancel
          </MatrixButton>
          <MatrixButton type="button" variant="primary" size="md" onClick={submit}>
            Save
          </MatrixButton>
        </div>
      </div>
    </div>
  );
}

export default function CopyCountEntryDialog(props: Props) {
  if (!props.open) return null;
  return (
    <CopyCountEntryForm
      key={`copy-${props.currentCopyCount ?? "x"}-${props.previousCopyCount ?? "y"}`}
      currentCopyCount={props.currentCopyCount}
      previousCopyCount={props.previousCopyCount}
      onClose={props.onClose}
      onSave={props.onSave}
    />
  );
}
