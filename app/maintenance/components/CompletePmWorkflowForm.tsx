"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MatrixButton } from "@/app/components/ui";
import {
  calculateLaborMinutes,
  checklistCompletionPercent,
  validatePmTimeRange,
  type PmPartUsed,
  type PmWorkflowChecklistItem,
} from "@/lib/maintenance/pm-checklist";
import { calculatePmQualityScore } from "@/lib/maintenance/pm-quality";
import {
  fetchPmChecklist,
  fetchPmDraft,
  lookupPmPart,
  newIdempotencyKey,
  postCompletePm,
  savePmDraftClient,
} from "@/lib/maintenance/pm-api-client";

type Props = {
  machineId: string;
  printerModel?: string | null;
  defaultMeter: number | null;
  defaultTechnician: string;
  disabled?: boolean;
  onCompleted: (notice: string) => void;
  onError: (error: string) => void;
};

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CompletePmWorkflowForm({
  machineId,
  printerModel,
  defaultMeter,
  defaultTechnician,
  disabled,
  onCompleted,
  onError,
}: Props) {
  const [technician, setTechnician] = useState(defaultTechnician);
  const [completedDate, setCompletedDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [timeStarted, setTimeStarted] = useState(() =>
    toLocalInputValue(new Date(Date.now() - 60 * 60 * 1000)),
  );
  const [timeFinished, setTimeFinished] = useState(() =>
    toLocalInputValue(new Date()),
  );
  const [meter, setMeter] = useState(
    defaultMeter != null ? String(defaultMeter) : "",
  );
  const [notes, setNotes] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [signaturePlaceholder, setSignaturePlaceholder] = useState("");
  const [checklist, setChecklist] = useState<PmWorkflowChecklistItem[]>([]);
  const [parts, setParts] = useState<PmPartUsed[]>([]);
  const [partId, setPartId] = useState<string | null>(null);
  const [partNumber, setPartNumber] = useState("");
  const [partDesc, setPartDesc] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [loadingChecklist, setLoadingChecklist] = useState(true);
  const [draftNotice, setDraftNotice] = useState("");

  const laborMinutes = useMemo(
    () => calculateLaborMinutes(timeStarted, timeFinished),
    [timeStarted, timeFinished],
  );

  const progressPct = useMemo(
    () => checklistCompletionPercent(checklist),
    [checklist],
  );

  const liveQuality = useMemo(
    () =>
      calculatePmQualityScore({
        checklist,
        notes,
        partsUsed: parts,
        meterRecorded: meter.trim() !== "",
        laborMinutes,
      }),
    [checklist, notes, parts, meter, laborMinutes],
  );

  const loadChecklistAndDraft = useCallback(async () => {
    setLoadingChecklist(true);
    try {
      const techName = defaultTechnician.trim() || "Technician";
      const [checkRes, draftRes] = await Promise.all([
        fetchPmChecklist(printerModel),
        fetchPmDraft(machineId, techName),
      ]);
      if (draftRes.ok && draftRes.draft) {
        setChecklist(draftRes.draft.checklist);
        setParts(draftRes.draft.partsUsed ?? []);
        setNotes(draftRes.draft.notes ?? "");
        if (draftRes.draft.timeStarted) {
          setTimeStarted(toLocalInputValue(new Date(draftRes.draft.timeStarted)));
        }
        if (draftRes.draft.meterReading != null) {
          setMeter(String(draftRes.draft.meterReading));
        }
        setDraftNotice(
          `Resumed draft saved ${new Date(draftRes.draft.updatedAt).toLocaleString()}`,
        );
      } else if (checkRes.ok && checkRes.checklist) {
        setChecklist(checkRes.checklist);
        setDraftNotice("");
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load checklist");
    } finally {
      setLoadingChecklist(false);
    }
  }, [machineId, printerModel, defaultTechnician, onError]);

  useEffect(() => {
    void loadChecklistAndDraft();
  }, [loadChecklistAndDraft]);

  useEffect(() => {
    setTechnician(defaultTechnician);
  }, [defaultTechnician]);

  useEffect(() => {
    if (defaultMeter != null) setMeter(String(defaultMeter));
  }, [defaultMeter]);

  function updateItem(
    itemKey: string,
    patch: Partial<PmWorkflowChecklistItem>,
  ) {
    setChecklist((prev) =>
      prev.map((i) => (i.itemKey === itemKey ? { ...i, ...patch } : i)),
    );
  }

  async function onLookupPart() {
    if (!partNumber.trim()) return;
    const res = await lookupPmPart(partNumber.trim());
    if (res.ok && res.part) {
      setPartId(res.part.partId);
      setPartDesc(res.part.description);
      setPartNumber(res.part.partNumber);
    } else {
      setPartId(null);
    }
  }

  function addPart() {
    const qty = Number(partQty);
    if (!partNumber.trim() || !partDesc.trim() || !Number.isFinite(qty) || qty <= 0) {
      onError("Part number, description, and positive quantity are required.");
      return;
    }
    setParts((prev) => [
      ...prev,
      {
        partId,
        partNumber: partNumber.trim(),
        description: partDesc.trim(),
        quantity: qty,
      },
    ]);
    setPartId(null);
    setPartNumber("");
    setPartDesc("");
    setPartQty("1");
  }

  async function onSaveDraft() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const result = await savePmDraftClient({
        machineId,
        technician: technician.trim(),
        checklist,
        partsUsed: parts,
        notes,
        timeStarted: new Date(timeStarted).toISOString(),
        meterReading: meter.trim() ? Number(meter) : null,
      });
      if (!result.ok) {
        onError(result.error ?? "Failed to save draft");
        return;
      }
      setDraftNotice("Progress saved. You can resume later.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || disabled) return;
    const count = Number(meter);
    if (!Number.isInteger(count) || count < 0) {
      onError("Current meter reading must be a nonnegative whole number.");
      return;
    }
    if (!technician.trim()) {
      onError("Technician is required.");
      return;
    }
    const timeCheck = validatePmTimeRange(timeStarted, timeFinished);
    if (!timeCheck.ok) {
      onError(timeCheck.error);
      return;
    }
    setBusy(true);
    try {
      const finishedIso = new Date(timeFinished).toISOString();
      const startedIso = new Date(timeStarted).toISOString();
      const completedAt = new Date(`${completedDate}T12:00:00`).toISOString();
      const result = await postCompletePm({
        machineId,
        countAtCompletion: count,
        technician: technician.trim(),
        recordedBy: technician.trim(),
        notes: notes.trim() || undefined,
        completedAt,
        timeStarted: startedIso,
        timeFinished: finishedIso,
        checklist,
        partsUsed: parts,
        workPerformed: workPerformed.trim() || undefined,
        customerSignaturePlaceholder:
          signaturePlaceholder.trim() || "Signature capture coming soon",
        idempotencyKey: newIdempotencyKey("pm-workflow"),
      });
      if (!result.ok) {
        onError(result.error ?? "Complete PM failed");
        return;
      }
      onCompleted(
        result.idempotent
          ? "Duplicate submission prevented — existing PM kept."
          : `PM completed. Quality score: ${result.qualityScore ?? "—"}%`,
      );
    } finally {
      setBusy(false);
    }
  }

  const doneCount = checklist.filter((i) => i.status === "DONE").length;
  const skipCount = checklist.filter((i) => i.status === "SKIPPED").length;

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      {draftNotice ? (
        <p className="rounded-lg bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
          {draftNotice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-400">
          Technician
          <input
            className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            required
            disabled={disabled}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Completion date
          <input
            type="date"
            className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100"
            value={completedDate}
            onChange={(e) => setCompletedDate(e.target.value)}
            required
            disabled={disabled}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Time started
          <input
            type="datetime-local"
            className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100"
            value={timeStarted}
            onChange={(e) => setTimeStarted(e.target.value)}
            required
            disabled={disabled}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Time finished
          <input
            type="datetime-local"
            className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100"
            value={timeFinished}
            onChange={(e) => setTimeFinished(e.target.value)}
            required
            disabled={disabled}
          />
        </label>
        <label className="block text-sm text-slate-400">
          Labor time (auto)
          <input
            className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-base text-slate-300"
            value={
              laborMinutes == null ? "—" : `${laborMinutes} min`
            }
            readOnly
            aria-readonly
          />
        </label>
        <label className="block text-sm text-slate-400">
          Current meter reading
          <input
            className="mt-1 min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100"
            value={meter}
            onChange={(e) => setMeter(e.target.value)}
            inputMode="numeric"
            required
            disabled={disabled}
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">PM Checklist</h3>
          <p className="text-xs text-slate-400">
            {doneCount} done · {skipCount} skipped · {progressPct}% · Quality{" "}
            {liveQuality}%
          </p>
        </div>
        <div
          className="mb-3 h-2 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-cyan-500 transition-all"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>
        {loadingChecklist ? (
          <p className="text-sm text-slate-500">Loading checklist…</p>
        ) : (
          <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {checklist.map((item) => (
              <li
                key={item.itemKey}
                className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-100">
                      {item.taskName}
                      {item.required ? (
                        <span className="ml-2 text-xs text-amber-400">Required</span>
                      ) : null}
                    </p>
                    {item.description ? (
                      <p className="text-xs text-slate-500">{item.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MatrixButton
                      type="button"
                      size="sm"
                      variant={item.status === "DONE" ? "primary" : "secondary"}
                      className="min-h-11 min-w-[5.5rem]"
                      disabled={disabled}
                      onClick={() =>
                        updateItem(item.itemKey, {
                          status: "DONE",
                          skipReason: "",
                        })
                      }
                    >
                      Done
                    </MatrixButton>
                    <MatrixButton
                      type="button"
                      size="sm"
                      variant={
                        item.status === "SKIPPED" ? "primary" : "secondary"
                      }
                      className="min-h-11 min-w-[5.5rem]"
                      disabled={disabled}
                      onClick={() =>
                        updateItem(item.itemKey, { status: "SKIPPED" })
                      }
                    >
                      Skip
                    </MatrixButton>
                  </div>
                </div>
                {item.status === "SKIPPED" ? (
                  <label className="mt-2 block text-xs text-slate-400">
                    Skip reason (required)
                    <input
                      className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                      value={item.skipReason}
                      onChange={(e) =>
                        updateItem(item.itemKey, {
                          skipReason: e.target.value,
                        })
                      }
                      required
                      disabled={disabled}
                    />
                  </label>
                ) : null}
                <label className="mt-2 block text-xs text-slate-400">
                  Item notes
                  <input
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={item.notes}
                    onChange={(e) =>
                      updateItem(item.itemKey, { notes: e.target.value })
                    }
                    disabled={disabled}
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Parts used</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          <input
            className="min-h-12 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
            placeholder="Part number"
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            onBlur={() => void onLookupPart()}
            disabled={disabled}
          />
          <input
            className="min-h-12 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100 sm:col-span-2"
            placeholder="Description"
            value={partDesc}
            onChange={(e) => setPartDesc(e.target.value)}
            disabled={disabled}
          />
          <div className="flex gap-2">
            <input
              className="min-h-12 w-20 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
              placeholder="Qty"
              value={partQty}
              onChange={(e) => setPartQty(e.target.value)}
              inputMode="numeric"
              disabled={disabled}
            />
            <MatrixButton
              type="button"
              variant="secondary"
              className="min-h-12 flex-1"
              onClick={addPart}
              disabled={disabled}
            >
              Add
            </MatrixButton>
          </div>
        </div>
        {parts.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {parts.map((p, idx) => (
              <li
                key={`${p.partNumber}-${idx}`}
                className="flex items-center justify-between gap-2"
              >
                <span>
                  {p.partNumber} — {p.description} × {p.quantity}
                </span>
                <button
                  type="button"
                  className="text-rose-300 hover:underline"
                  onClick={() =>
                    setParts((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No parts recorded.</p>
        )}
      </div>

      <label className="block text-sm text-slate-400">
        Notes
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm text-slate-400">
        Work performed
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100"
          rows={2}
          value={workPerformed}
          onChange={(e) => setWorkPerformed(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="block text-sm text-slate-400">
        Customer signature (placeholder)
        <input
          className="mt-1 min-h-12 w-full rounded-lg border border-dashed border-slate-600 bg-slate-950/60 px-3 py-3 text-base text-slate-400"
          placeholder="Future: capture customer signature here"
          value={signaturePlaceholder}
          onChange={(e) => setSignaturePlaceholder(e.target.value)}
          disabled={disabled}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <MatrixButton
          type="button"
          variant="secondary"
          className="min-h-12 min-w-[8rem]"
          disabled={busy || disabled}
          onClick={() => void onSaveDraft()}
        >
          Save progress
        </MatrixButton>
        <MatrixButton
          type="submit"
          variant="primary"
          className="min-h-12 min-w-[10rem]"
          disabled={busy || disabled}
        >
          {busy ? "Saving…" : "Complete PM"}
        </MatrixButton>
      </div>
    </form>
  );
}
