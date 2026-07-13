"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixSection,
} from "../components/ui";
import {
  digitalTwinFleet,
  digitalTwinTechnicians,
} from "@/lib/digital-twin/data";
import {
  createServiceCall,
  setMachineStatusOverride,
  snapshotMachineForServiceCall,
  type ServiceCallPriority,
  type ServiceCallType,
} from "@/lib/service-calls";

const SERVICE_TYPES: ServiceCallType[] = [
  "BREAK_FIX",
  "PREVENTIVE_MAINTENANCE",
  "INSTALLATION",
  "NETWORK_SUPPORT",
  "OPERATOR_TRAINING",
  "INSPECTION",
  "REMOTE_SUPPORT",
  "FOLLOW_UP",
  "OTHER",
];

const PRIORITIES: ServiceCallPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
  "EMERGENCY",
];

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none";
const labelClass = "block text-sm text-slate-300";

export default function ServiceCallCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = searchParams.get("machineId") ?? "";

  const [machineId, setMachineId] = useState(preselected);
  const [machineQuery, setMachineQuery] = useState("");
  const [serviceType, setServiceType] = useState<ServiceCallType>("BREAK_FIX");
  const [issueTitle, setIssueTitle] = useState("");
  const [problemDescription, setProblemDescription] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [customerImpact, setCustomerImpact] = useState("");
  const [machineCurrentlyDown, setMachineCurrentlyDown] = useState(false);
  const [priority, setPriority] = useState<ServiceCallPriority>("NORMAL");
  const [priorityLockedEmergency, setPriorityLockedEmergency] = useState(false);
  const [reportedBy, setReportedBy] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [technician, setTechnician] = useState("");
  const [serviceManager, setServiceManager] = useState("Jordan Hale");
  const [organization, setOrganization] = useState("");
  const [region, setRegion] = useState("");
  const [requestedServiceDate, setRequestedServiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [scheduledStart, setScheduledStart] = useState("");
  const [estimatedDurationHours, setEstimatedDurationHours] = useState(2);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const snapshot = useMemo(
    () => (machineId ? snapshotMachineForServiceCall(machineId) : null),
    [machineId],
  );

  const machineOptions = useMemo(() => {
    const q = machineQuery.trim().toLowerCase();
    return digitalTwinFleet.filter((m) => {
      if (!q) return true;
      const hay = [
        m.identity.machineId,
        m.identity.assetTag,
        m.identity.serialNumber,
        m.identity.printerModel,
        m.identity.nickname,
        m.location.customerName,
        m.location.siteName,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [machineQuery]);

  function selectMachine(id: string) {
    setMachineId(id);
    const snap = snapshotMachineForServiceCall(id);
    if (snap) {
      setOrganization(snap.organization);
      setRegion(snap.region);
    }
  }

  function onEmergencyToggle(checked: boolean) {
    setMachineCurrentlyDown(checked);
    if (checked) {
      setPriority("EMERGENCY");
      setPriorityLockedEmergency(true);
    } else {
      setPriorityLockedEmergency(false);
      if (priority === "EMERGENCY") setPriority("HIGH");
    }
  }

  function submit(isDraft: boolean) {
    setError("");
    setNotice("");
    if (!machineId) {
      setError("Select a Digital Twin machine.");
      return;
    }
    if (!issueTitle.trim()) {
      setError("Issue title is required.");
      return;
    }
    if (!problemDescription.trim() && !isDraft) {
      setError("Problem description is required.");
      return;
    }

    const result = createServiceCall({
      machineId,
      serviceType,
      issueTitle: issueTitle.trim(),
      problemDescription: problemDescription.trim(),
      errorCode: errorCode.trim(),
      symptoms: symptoms.trim(),
      customerImpact: customerImpact.trim(),
      machineCurrentlyDown,
      priority,
      reportedBy: reportedBy.trim() || "Unknown reporter",
      reporterPhone: reporterPhone.trim(),
      reporterEmail: reporterEmail.trim(),
      technician,
      serviceManager,
      organization: organization || snapshot?.organization || "",
      region: region || snapshot?.region || "",
      requestedServiceDate,
      scheduledStart,
      estimatedDurationHours,
      isDraft,
      createdBy: "Matrix User",
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (machineCurrentlyDown) {
      setMachineStatusOverride({
        machineId,
        status: "DOWN",
        alertTitle: `Emergency service call ${result.call.workOrderNumber}`,
      });
    }

    setNotice(
      isDraft
        ? `Draft ${result.call.workOrderNumber} saved (local session).`
        : `Created ${result.call.workOrderNumber}.`,
    );
    router.push(`/service-calls/${result.call.id}`);
  }

  return (
    <div className="mt-6 space-y-6">
      {notice && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div
        className={`space-y-6 rounded-xl border p-1 ${
          machineCurrentlyDown
            ? "border-rose-500/60 bg-rose-500/5 ring-1 ring-rose-500/30"
            : "border-transparent"
        }`}
      >
        {machineCurrentlyDown && (
          <div className="mx-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-100">
            Emergency / machine-down mode — priority set to EMERGENCY. Linked
            Digital Twin will be marked DOWN in local mock state on create.
          </div>
        )}

        <MatrixSection title="Machine">
          <MatrixCard title="Select Digital Twin machine">
            <label className={labelClass}>
              Search machines
              <input
                className={fieldClass}
                value={machineQuery}
                onChange={(e) => setMachineQuery(e.target.value)}
                placeholder="Asset, serial, model, customer…"
              />
            </label>
            <label className={`${labelClass} mt-3`}>
              Machine
              <select
                className={fieldClass}
                value={machineId}
                onChange={(e) => selectMachine(e.target.value)}
              >
                <option value="">Select a machine…</option>
                {machineOptions.map((m) => (
                  <option
                    key={m.identity.machineId}
                    value={m.identity.machineId}
                  >
                    {m.identity.machineId} · {m.identity.printerModel} ·{" "}
                    {m.identity.assetTag} · {m.location.siteName}
                  </option>
                ))}
              </select>
            </label>

            {snapshot && (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                {[
                  ["Asset tag", snapshot.assetTag],
                  ["Serial", snapshot.serialNumber],
                  ["Model", snapshot.printerModel],
                  ["Nickname", snapshot.nickname],
                  ["Customer", snapshot.customerName],
                  ["Site", snapshot.siteName],
                  ["Location", snapshot.machineLocation],
                  ["Meter", String(snapshot.currentMeterCount)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-white">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </MatrixCard>
        </MatrixSection>

        <MatrixSection title="Issue">
          <MatrixCard title="Problem details">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Service type
                <select
                  className={fieldClass}
                  value={serviceType}
                  onChange={(e) =>
                    setServiceType(e.target.value as ServiceCallType)
                  }
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Error code
                <input
                  className={fieldClass}
                  value={errorCode}
                  onChange={(e) => setErrorCode(e.target.value)}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Issue title
                <input
                  className={fieldClass}
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  required
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Problem description
                <textarea
                  className={fieldClass + " min-h-[100px]"}
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Symptoms
                <textarea
                  className={fieldClass}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Customer impact
                <textarea
                  className={fieldClass}
                  value={customerImpact}
                  onChange={(e) => setCustomerImpact(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-200 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={machineCurrentlyDown}
                  onChange={(e) => onEmergencyToggle(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-600"
                />
                Machine currently down / emergency
              </label>
            </div>
          </MatrixCard>
        </MatrixSection>

        <MatrixSection title="Priority">
          <MatrixCard title="Priority selection">
            <label className={labelClass}>
              Priority
              <select
                className={fieldClass}
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value as ServiceCallPriority);
                  setPriorityLockedEmergency(false);
                }}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                    {priorityLockedEmergency && p === "EMERGENCY"
                      ? " (auto from down-machine)"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Managers may override EMERGENCY after the down-machine toggle sets
              it automatically.
            </p>
          </MatrixCard>
        </MatrixSection>

        <MatrixSection title="Contact">
          <MatrixCard title="Reporter">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className={labelClass}>
                Reported by
                <input
                  className={fieldClass}
                  value={reportedBy}
                  onChange={(e) => setReportedBy(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Phone
                <input
                  className={fieldClass}
                  value={reporterPhone}
                  onChange={(e) => setReporterPhone(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Email
                <input
                  type="email"
                  className={fieldClass}
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                />
              </label>
            </div>
          </MatrixCard>
        </MatrixSection>

        <MatrixSection title="Assignment">
          <MatrixCard title="Dispatch">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Assigned technician
                <select
                  className={fieldClass}
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {digitalTwinTechnicians.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Service manager
                <input
                  className={fieldClass}
                  value={serviceManager}
                  onChange={(e) => setServiceManager(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Organization
                <input
                  className={fieldClass}
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Region
                <input
                  className={fieldClass}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </label>
            </div>
          </MatrixCard>
        </MatrixSection>

        <MatrixSection title="Schedule">
          <MatrixCard title="Timing">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className={labelClass}>
                Requested date
                <input
                  type="date"
                  className={fieldClass}
                  value={requestedServiceDate}
                  onChange={(e) => setRequestedServiceDate(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Scheduled start
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Estimated duration (hours)
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  className={fieldClass}
                  value={estimatedDurationHours}
                  onChange={(e) =>
                    setEstimatedDurationHours(Number(e.target.value) || 0)
                  }
                />
              </label>
            </div>
          </MatrixCard>
        </MatrixSection>

        <MatrixSection title="Attachments">
          <MatrixCard title="Uploads">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                Photo upload placeholder — not connected yet
              </div>
              <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500">
                Document upload placeholder — not connected yet
              </div>
            </div>
          </MatrixCard>
        </MatrixSection>
      </div>

      <div className="flex flex-wrap gap-3">
        <MatrixButton
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => submit(true)}
        >
          Save Draft
        </MatrixButton>
        <MatrixButton
          type="button"
          variant="primary"
          size="lg"
          onClick={() => submit(false)}
        >
          Create Service Call
        </MatrixButton>
        {!confirmCancel ? (
          <MatrixButton
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel
          </MatrixButton>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Discard this form?
            <MatrixButton
              type="button"
              variant="danger"
              size="sm"
              onClick={() => router.push("/service-calls")}
            >
              Yes, discard
            </MatrixButton>
            <MatrixButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setConfirmCancel(false)}
            >
              Keep editing
            </MatrixButton>
          </div>
        )}
      </div>
    </div>
  );
}
