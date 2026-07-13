"use client";

import { useEffect, useId, useState } from "react";
import { MatrixButton } from "@/app/components/ui";
import type { MaintenanceKind } from "@/lib/maintenance";

const KINDS: { value: MaintenanceKind; label: string }[] = [
  { value: "PM", label: "Preventive Maintenance" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "JOINT_UNIT", label: "Joint Unit PM" },
  { value: "DTF_PM", label: "DTF PM" },
];

type Props = {
  open: boolean;
  printerName: string;
  defaultCopyCount: number | null;
  initialKind?: MaintenanceKind;
  onClose: () => void;
  onSave: (input: {
    kind: MaintenanceKind;
    completedAt: string;
    copyCountAtCompletion: number;
    technician: string;
    notes: string;
    workPerformed: string;
  }) => void;
};

function CompleteMaintenanceForm({
  printerName,
  defaultCopyCount,
  initialKind = "PM",
  onClose,
  onSave,
}: Omit<Props, "open">) {
  const titleId = useId();
  const [kind, setKind] = useState<MaintenanceKind>(initialKind);
  const [completedAt, setCompletedAt] = useState(
    () => new Date().toISOString().slice(0, 16),
  );
  const [copyCount, setCopyCount] = useState(
    defaultCopyCount !== null ? String(defaultCopyCount) : "",
  );
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    const parsed = Number(copyCount.replace(/,/g, ""));
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Copy count at completion must be a non-negative whole number.");
      return;
    }
    if (!technician.trim()) {
      setError("Technician is required.");
      return;
    }
    onSave({
      kind,
      completedAt: new Date(completedAt).toISOString(),
      copyCountAtCompletion: parsed,
      technician: technician.trim(),
      notes,
      workPerformed,
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 id={titleId} className="text-xl font-bold text-white">
            Complete Maintenance
          </h2>
          <p className="mt-1 text-sm text-slate-400">{printerName}</p>
        </div>
        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}
          <label className="block text-sm text-slate-300">
            Maintenance type
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={kind}
              onChange={(e) => setKind(e.target.value as MaintenanceKind)}
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            Completion date
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Copy count at completion
            <input
              type="number"
              min={0}
              step={1}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={copyCount}
              onChange={(e) => setCopyCount(e.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Technician
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Notes
            <textarea
              className="mt-1 min-h-[70px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Parts used / work performed
            <textarea
              className="mt-1 min-h-[70px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              value={workPerformed}
              onChange={(e) => setWorkPerformed(e.target.value)}
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

export default function CompleteMaintenanceDialog(props: Props) {
  if (!props.open) return null;
  return (
    <CompleteMaintenanceForm
      key={`complete-${props.initialKind ?? "PM"}-${props.defaultCopyCount ?? "x"}`}
      printerName={props.printerName}
      defaultCopyCount={props.defaultCopyCount}
      initialKind={props.initialKind}
      onClose={props.onClose}
      onSave={props.onSave}
    />
  );
}
