"use client";

import { useMemo, useState } from "react";
import MatrixShell from "../../components/MatrixShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
} from "../../components/ui";
import MaintenanceSubnav from "../components/MaintenanceSubnav";
import PMStatusBadge from "../components/PMStatusBadge";
import PMPartsKitCard from "../components/PMPartsKitCard";
import {
  createPmSchedule,
  getPmPartsKit,
  listIntervalRules,
  listPmScheduleRows,
  listProfiles,
  listSiteVisitPlan,
  startPmCompletion,
  updatePmCompletionSession,
  finalizePmCompletion,
} from "@/lib/pm-intelligence";

export default function PmSchedulePage() {
  const profiles = useMemo(() => listProfiles(), []);
  const [rows, setRows] = useState(() => listPmScheduleRows());
  const [printerId, setPrinterId] = useState(profiles[0]?.printerId ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tech, setTech] = useState("Alex Rivera");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [site, setSite] = useState(profiles[0]?.siteName ?? "");
  const [wizardId, setWizardId] = useState<string | null>(null);

  const sites = [...new Set(profiles.map((p) => p.siteName))];
  const plan = useMemo(() => listSiteVisitPlan(site), [site]);
  const kitId = listIntervalRules().find(
    (r) =>
      r.printerModel ===
      profiles.find((p) => p.printerId === printerId)?.printerModel,
  )?.requiredPartsKitId;
  const kit = kitId ? getPmPartsKit(kitId) : null;

  function refresh() {
    setRows(listPmScheduleRows());
  }

  function schedule() {
    setError("");
    const result = createPmSchedule({
      printerId,
      scheduledDate: date,
      technician: tech,
      actor: "Service Manager",
      notes: "Scheduled from PM Intelligence",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Scheduled ${result.id}`);
    refresh();
  }

  function startWizard(pid: string) {
    setError("");
    const profile = profiles.find((p) => p.printerId === pid);
    const session = startPmCompletion({
      printerId: pid,
      technician: tech,
    });
    const meter = profile?.currentCopyCount ?? 0;
    session.startingMeter = meter;
    session.endingMeter = meter;
    session.checklist = session.checklist.map((c) => ({
      ...c,
      completionStatus: "DONE",
      passFail: "PASS",
    }));
    const modelKitId = listIntervalRules().find(
      (r) => r.printerModel === profile?.printerModel,
    )?.requiredPartsKitId;
    const modelKit = modelKitId ? getPmPartsKit(modelKitId) : null;
    const part = modelKit?.requiredParts[0];
    if (part) {
      session.partsUsed = [{ partNumber: part.partNumber, quantity: 1 }];
    }
    updatePmCompletionSession(session);
    setWizardId(session.id);
    setNotice(`Started PM completion ${session.id}`);
  }

  function finishWizard() {
    if (!wizardId) return;
    setError("");
    const result = finalizePmCompletion(wizardId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(`Completed PM ${result.session.id}`);
    setWizardId(null);
    refresh();
  }

  return (
    <MatrixShell title="PM Schedule" activePath="/maintenance">
      <MatrixAuthGuard requiredPermissions={["VIEW_FLEET_MAINTENANCE"]}>
        <MatrixPageHeader
          title="PM Schedule"
          subtitle="Schedule visits, review parts readiness, group site work, and complete PMs."
          breadcrumbs={["Matrix", "Preventive Maintenance", "Schedule"]}
        />
        <MaintenanceSubnav />

        {error ? (
          <p className="mb-4 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mb-4 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {notice}
          </p>
        ) : null}

        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          <MatrixCard>
            <h2 className="mb-3 font-semibold text-slate-100">Schedule PM</h2>
            <div className="grid gap-3">
              <label className="text-sm">
                <span className="text-slate-500">Machine</span>
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
                  value={printerId}
                  onChange={(e) => setPrinterId(e.target.value)}
                >
                  {profiles.map((p) => (
                    <option key={p.printerId} value={p.printerId}>
                      {p.nickname} · {p.siteName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Date</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Technician</span>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2"
                  value={tech}
                  onChange={(e) => setTech(e.target.value)}
                />
              </label>
              <MatrixButton type="button" onClick={schedule}>
                Schedule PM
              </MatrixButton>
            </div>
          </MatrixCard>
          {kit ? <PMPartsKitCard kit={kit} availability="Warehouse check" /> : null}
        </div>

        <MatrixCard className="mb-8">
          <h2 className="mb-3 font-semibold text-slate-100">Site visit planner</h2>
          <label className="mb-3 block text-sm">
            <span className="text-slate-500">Site</span>
            <select
              className="mt-1 w-full max-w-md rounded border border-slate-700 bg-slate-900 px-2 py-2"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-slate-400">
            {plan.dueMachines.length} due/soon · {plan.cleaningsDue.length} cleanings ·{" "}
            {plan.allMachines.length} machines at site
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {plan.dueMachines.map((m) => (
              <li key={m.printerId} className="flex justify-between gap-2">
                <span className="text-slate-300">{m.machineName}</span>
                <div className="flex items-center gap-2">
                  <PMStatusBadge status={m.pmStatus} />
                  <MatrixButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => startWizard(m.printerId)}
                  >
                    Start PM
                  </MatrixButton>
                </div>
              </li>
            ))}
          </ul>
          {wizardId ? (
            <div className="mt-4">
              <MatrixButton type="button" onClick={finishWizard}>
                Complete PM workflow ({wizardId})
              </MatrixButton>
            </div>
          ) : null}
        </MatrixCard>

        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Technician</th>
                <th className="px-3 py-2">Parts</th>
                <th className="px-3 py-2">Labor</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-slate-300">{r.scheduledDate}</td>
                  <td className="px-3 py-2 text-slate-400">{r.customerName}</td>
                  <td className="px-3 py-2 text-slate-100">{r.machineName}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {r.assignedTechnician ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{r.partsAvailability}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {r.estimatedLaborHours}h
                  </td>
                  <td className="px-3 py-2">
                    <PMStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MatrixAuthGuard>
    </MatrixShell>
  );
}
