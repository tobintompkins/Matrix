"use client";
import { useFieldIdentity } from "@/app/field/FieldIdentityProvider";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import FieldShell from "../FieldShell";
import { enqueueOperation, savePendingAttachment } from "@/lib/field";
import { getMaintenanceProfile } from "@/lib/maintenance";
import { validateWholeNonNegativeCount } from "@/lib/maintenance/calculations";


function CopyCountForm() {
  const { technicianName: TECH, userId: TECH_ID } = useFieldIdentity();
  const params = useSearchParams();
  const printerId = params.get("printerId") ?? "";
  const workOrderId = params.get("workOrderId") ?? "";
  const profile = useMemo(
    () => (printerId ? getMaintenanceProfile(printerId) : null),
    [printerId],
  );
  const [count, setCount] = useState(
    profile?.currentCopyCount != null ? String(profile.currentCopyCount) : "",
  );
  const [notes, setNotes] = useState("");
  const [lowerReason, setLowerReason] = useState("");
  const [notice, setNotice] = useState("");

  const previous = profile?.currentCopyCount ?? null;
  const parsed = Number(count);
  const diff =
    previous != null && Number.isFinite(parsed) ? parsed - previous : null;
  const needsLowerReason =
    previous != null && Number.isFinite(parsed) && parsed < previous;

  async function save() {
    const validated = validateWholeNonNegativeCount(parsed);
    if (!validated.ok) {
      setNotice(validated.error);
      return;
    }
    if (needsLowerReason && !lowerReason.trim()) {
      setNotice("Provide a reason when the count is lower than the previous reading.");
      return;
    }
    await enqueueOperation({
      type: "COPY_COUNT",
      userId: TECH_ID,
      technicianName: TECH,
      workOrderId: workOrderId || null,
      printerId: printerId || null,
      payload: {
        copyCount: validated.value,
        note: notes,
        lowerCountReason: lowerReason || undefined,
        phase: "end",
        readingAt: new Date().toISOString(),
      },
    });
    setNotice("Copy count saved to offline queue. Sync will reuse maintenance validation.");
  }

  return (
    <>
      {profile && (
        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
          <p className="font-semibold text-white">
            {profile.nickname || profile.assetTag}
          </p>
          <p className="text-slate-400">
            Previous: {previous?.toLocaleString() ?? "—"}
            {diff != null ? ` · Δ ${diff.toLocaleString()}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Next PM {profile.nextPMDueCount?.toLocaleString() ?? "—"} · Next
            cleaning {profile.nextCleaningDueCount?.toLocaleString() ?? "—"}
          </p>
        </div>
      )}

      <label className="block text-xs text-slate-400" htmlFor="cc">
        Current copy count
      </label>
      <input
        id="cc"
        inputMode="numeric"
        value={count}
        onChange={(e) => setCount(e.target.value)}
        className="mt-1 min-h-14 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-xl"
      />

      <label className="mt-4 block text-xs text-slate-400" htmlFor="cc-notes">
        Notes
      </label>
      <textarea
        id="cc-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
      />

      {needsLowerReason && (
        <>
          <label className="mt-4 block text-xs text-amber-300" htmlFor="lower">
            Reason for lower count
          </label>
          <input
            id="lower"
            value={lowerReason}
            onChange={(e) => setLowerReason(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-amber-700 bg-slate-900 px-4"
          />
        </>
      )}

      <label className="mt-4 block text-xs text-slate-400">
        Optional counter photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-2 block w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !workOrderId) return;
            const reader = new FileReader();
            reader.onload = () => {
              void (async () => {
                const dataRef = String(reader.result ?? "");
                const op = await enqueueOperation({
                  type: "PHOTO",
                  userId: TECH_ID,
                  technicianName: TECH,
                  workOrderId,
                  printerId,
                  payload: {
                    category: "PRINTER_COUNTER",
                    fileName: file.name,
                    mimeType: file.type,
                    sizeBytes: file.size,
                    caption: "Counter screen",
                    dataRef: dataRef.slice(0, 120),
                  },
                });
                await savePendingAttachment({
                  operationId: op.operationId,
                  workOrderId,
                  category: "PRINTER_COUNTER",
                  fileName: file.name,
                  mimeType: file.type,
                  sizeBytes: file.size,
                  caption: "Counter screen",
                  dataRef,
                });
                setNotice("Counter photo queued with copy count.");
              })();
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>

      {notice && (
        <p className="mt-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        className="mt-6 min-h-14 w-full rounded-xl bg-cyan-500 text-base font-semibold text-slate-950"
      >
        Save Copy Count
      </button>
    </>
  );
}

export default function FieldCopyCountPage() {
  return (
    <FieldShell title="Copy Count">
      <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
        <CopyCountForm />
      </Suspense>
    </FieldShell>
  );
}
