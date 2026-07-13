"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import FieldShell from "../FieldShell";
import { enqueueOperation } from "@/lib/field";
import { getMaintenanceProfile } from "@/lib/maintenance";
import type { MaintenanceKind } from "@/lib/maintenance";

const TECH = "Toby Tompkins";
const TECH_ID = "tech-toby";

function MaintenanceForm() {
  const params = useSearchParams();
  const printerId = params.get("printerId") ?? "";
  const workOrderId = params.get("workOrderId") ?? "";
  const profile = useMemo(
    () => (printerId ? getMaintenanceProfile(printerId) : null),
    [printerId],
  );
  const [kind, setKind] = useState<MaintenanceKind>("PM");
  const [copyCount, setCopyCount] = useState(
    profile?.currentCopyCount != null ? String(profile.currentCopyCount) : "",
  );
  const [workPerformed, setWorkPerformed] = useState("");
  const [notes, setNotes] = useState("");
  const [issues, setIssues] = useState("");
  const [followUp, setFollowUp] = useState(false);
  const [notice, setNotice] = useState("");

  async function save() {
    if (!printerId) {
      setNotice("Select a printer first.");
      return;
    }
    await enqueueOperation({
      type: "MAINTENANCE_COMPLETION",
      userId: TECH_ID,
      technicianName: TECH,
      workOrderId: workOrderId || null,
      printerId,
      payload: {
        kind,
        copyCount: Number(copyCount),
        completedAt: new Date().toISOString(),
        workPerformed,
        notes,
        issuesDiscovered: issues,
        followUpRequired: followUp,
        checklistComplete: true,
      },
    });
    setNotice(
      "Maintenance completion queued. Sync will update baselines and recalculate due counts.",
    );
  }

  return (
    <>
      {profile && (
        <p className="mb-4 text-sm text-slate-400">
          {profile.nickname || profile.assetTag} · {profile.printerModel}
        </p>
      )}
      <label className="block text-xs text-slate-400" htmlFor="kind">
        Maintenance type
      </label>
      <select
        id="kind"
        value={kind}
        onChange={(e) => setKind(e.target.value as MaintenanceKind)}
        className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4"
      >
        <option value="PM">PM</option>
        <option value="CLEANING">Cleaning</option>
        <option value="JOINT_UNIT">Joint Unit PM</option>
        <option value="DTF_PM">DTF PM</option>
      </select>

      <label className="mt-4 block text-xs text-slate-400" htmlFor="m-count">
        Copy count at completion
      </label>
      <input
        id="m-count"
        value={copyCount}
        onChange={(e) => setCopyCount(e.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-900 px-4"
      />

      <label className="mt-4 block text-xs text-slate-400" htmlFor="work">
        Work performed
      </label>
      <textarea
        id="work"
        value={workPerformed}
        onChange={(e) => setWorkPerformed(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
      />

      <label className="mt-4 block text-xs text-slate-400" htmlFor="m-notes">
        Technician notes
      </label>
      <textarea
        id="m-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
      />

      <label className="mt-4 block text-xs text-slate-400" htmlFor="issues">
        Issues discovered
      </label>
      <textarea
        id="issues"
        value={issues}
        onChange={(e) => setIssues(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"
      />

      <label className="mt-4 flex min-h-12 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={followUp}
          onChange={(e) => setFollowUp(e.target.checked)}
          className="h-5 w-5"
        />
        Follow-up required
      </label>

      {notice && (
        <p className="mt-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100">
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        className="mt-6 min-h-14 w-full rounded-xl bg-cyan-500 font-semibold text-slate-950"
      >
        Save Maintenance (Offline OK)
      </button>
    </>
  );
}

export default function FieldMaintenancePage() {
  return (
    <FieldShell title="Maintenance">
      <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
        <MaintenanceForm />
      </Suspense>
    </FieldShell>
  );
}
