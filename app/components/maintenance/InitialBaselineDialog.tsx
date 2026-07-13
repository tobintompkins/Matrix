"use client";

import { useEffect, useId, useState } from "react";
import { MatrixButton } from "@/app/components/ui";

type Props = {
  open: boolean;
  printerName: string;
  onClose: () => void;
  onSave: (input: {
    lastPMCopyCount: number | null;
    lastCleaningCopyCount: number | null;
    lastJointUnitCopyCount: number | null;
    lastDTFPMCopyCount: number | null;
    lastPMDate: string | null;
    lastCleaningDate: string | null;
    lastJointUnitDate: string | null;
    lastDTFPMDate: string | null;
    notes: string;
  }) => void;
};

function parseOptionalCount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  if (!Number.isInteger(n) || n < 0) return Number.NaN;
  return n;
}

function InitialBaselineForm({
  printerName,
  onClose,
  onSave,
}: Omit<Props, "open">) {
  const titleId = useId();
  const [pmCount, setPmCount] = useState("");
  const [cleaningCount, setCleaningCount] = useState("");
  const [jointCount, setJointCount] = useState("");
  const [dtfCount, setDtfCount] = useState("");
  const [pmDate, setPmDate] = useState("");
  const [cleaningDate, setCleaningDate] = useState("");
  const [jointDate, setJointDate] = useState("");
  const [dtfDate, setDtfDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    const values = [
      parseOptionalCount(pmCount),
      parseOptionalCount(cleaningCount),
      parseOptionalCount(jointCount),
      parseOptionalCount(dtfCount),
    ];
    if (values.some((v) => Number.isNaN(v))) {
      setError("Counts must be blank or non-negative whole numbers.");
      return;
    }
    onSave({
      lastPMCopyCount: values[0],
      lastCleaningCopyCount: values[1],
      lastJointUnitCopyCount: values[2],
      lastDTFPMCopyCount: values[3],
      lastPMDate: pmDate || null,
      lastCleaningDate: cleaningDate || null,
      lastJointUnitDate: jointDate || null,
      lastDTFPMDate: dtfDate || null,
      notes,
    });
  }

  const field =
    "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white";

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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 id={titleId} className="text-xl font-bold text-white">
            Initial Maintenance Setup
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {printerName} — leave unknown fields blank. No fake history is
            created.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}
          {(
            [
              ["Last known PM copy count", pmCount, setPmCount, pmDate, setPmDate],
              [
                "Last known cleaning copy count",
                cleaningCount,
                setCleaningCount,
                cleaningDate,
                setCleaningDate,
              ],
              [
                "Last known Joint Unit PM copy count",
                jointCount,
                setJointCount,
                jointDate,
                setJointDate,
              ],
              [
                "Last known DTF PM copy count",
                dtfCount,
                setDtfCount,
                dtfDate,
                setDtfDate,
              ],
            ] as const
          ).map(([label, count, setCount, date, setDate]) => (
            <div key={label} className="grid gap-2 sm:grid-cols-2">
              <label className="block text-sm text-slate-300">
                {label}
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  placeholder="Blank if unknown"
                />
              </label>
              <label className="block text-sm text-slate-300">
                Completion date
                <input
                  type="date"
                  className={field}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>
          ))}
          <label className="block text-sm text-slate-300">
            Notes (source of information)
            <textarea
              className={field + " min-h-[80px]"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. From prior service log / customer report"
            />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 px-6 py-4">
          <MatrixButton type="button" variant="secondary" size="md" onClick={onClose}>
            Cancel
          </MatrixButton>
          <MatrixButton type="button" variant="primary" size="md" onClick={submit}>
            Save Baseline
          </MatrixButton>
        </div>
      </div>
    </div>
  );
}

export default function InitialBaselineDialog(props: Props) {
  if (!props.open) return null;
  return (
    <InitialBaselineForm
      key="baseline-form"
      printerName={props.printerName}
      onClose={props.onClose}
      onSave={props.onSave}
    />
  );
}
