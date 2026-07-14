"use client";

import type { ReactNode } from "react";
import type { RelationshipImpact } from "@/lib/admin/data/types";
import RelationshipImpactViewer from "./RelationshipImpactViewer";

export default function AdminCorrectionDialog({
  open,
  title,
  currentValue,
  proposedValue,
  reason,
  onReasonChange,
  impact,
  auditImpact,
  onCancel,
  onConfirm,
  confirmLabel = "Apply Correction",
  busy = false,
  children,
}: {
  open: boolean;
  title: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  onReasonChange: (value: string) => void;
  impact?: RelationshipImpact | null;
  auditImpact?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  busy?: boolean;
  children?: ReactNode;
}) {
  if (!open) return null;
  const canSubmit = reason.trim().length >= 3 && !busy;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-correction-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <h2
          id="admin-correction-title"
          className="text-lg font-semibold text-white"
        >
          {title}
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-slate-500">Current Value</dt>
            <dd className="text-slate-200">{currentValue || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Proposed Value</dt>
            <dd className="text-cyan-200">{proposedValue || "—"}</dd>
          </div>
        </dl>
        {children}
        {impact ? (
          <div className="mt-4">
            <RelationshipImpactViewer impact={impact} />
          </div>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">
          Audit Impact:{" "}
          {auditImpact ??
            "Previous and new values will be recorded in audit history."}
        </p>
        <label className="mt-4 block text-sm text-slate-400">
          Reason for Change
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            rows={3}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            required
          />
        </label>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="min-h-10 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-10 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
