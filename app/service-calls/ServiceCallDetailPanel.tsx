"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixSection,
  MatrixStatusBadge,
} from "../components/ui";
import { sampleInventoryItems } from "@/lib/inventory/data";
import { createServiceCallPartsOrderDraftLine } from "@/lib/inventory/helpers";
import type { PartsOrderDraftLine } from "@/lib/inventory/types";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import {
  addServiceCallNote,
  addServiceCallPart,
  getAllowedServiceCallTransitions,
  getServiceCall,
  getServiceCallPriorityBadgeClassName,
  getServiceCallPriorityBadgeVariant,
  getServiceCallPriorityLabel,
  getServiceCallStatusBadgeVariant,
  getServiceCallStatusLabel,
  getServiceCallTypeLabel,
  reassignServiceCall,
  replaceServiceCall,
  setMachineStatusOverride,
  updateServiceCallResolution,
  updateServiceCallStatus,
  type FinalMachineStatus,
  type ServiceCall,
  type ServiceCallNoteType,
  type ServiceCallStatus,
} from "@/lib/service-calls";
import { digitalTwinTechnicians } from "@/lib/digital-twin/data";

type TabId =
  | "overview"
  | "activity"
  | "diagnosis"
  | "parts"
  | "schedule"
  | "notes"
  | "customer"
  | "attachments";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "parts", label: "Parts" },
  { id: "schedule", label: "Schedule" },
  { id: "notes", label: "Notes" },
  { id: "customer", label: "Customer" },
  { id: "attachments", label: "Attachments" },
];

const FINAL_STATUSES: FinalMachineStatus[] = [
  "OPERATIONAL",
  "OPERATIONAL_WITH_LIMITATIONS",
  "WAITING_FOR_PARTS",
  "DOWN",
  "REQUIRES_FOLLOW_UP",
];

const NOTE_TYPES: ServiceCallNoteType[] = [
  "GENERAL",
  "DIAGNOSIS",
  "CUSTOMER_CONTACT",
  "PARTS",
  "ESCALATION",
  "FOLLOW_UP",
];

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none";

type Props = { serviceCallId: string };

export default function ServiceCallDetailPanel({ serviceCallId }: Props) {
  const [call, setCall] = useState<ServiceCall | null>(
    () => getServiceCall(serviceCallId) ?? null,
  );
  const [tab, setTab] = useState<TabId>("overview");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [activityNewestFirst, setActivityNewestFirst] = useState(true);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [reassignTech, setReassignTech] = useState("");
  const [showReassign, setShowReassign] = useState(false);

  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState<ServiceCallNoteType>("GENERAL");
  const [noteInternal, setNoteInternal] = useState(true);

  const [partQuery, setPartQuery] = useState("");
  const [partsDraft, setPartsDraft] = useState<PartsOrderDraftLine[]>([]);

  const canViewInternal = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "VIEW_INTERNAL_NOTES",
  );

  const allowed = useMemo(
    () => (call ? getAllowedServiceCallTransitions(call.status) : []),
    [call],
  );

  function show(msg: string) {
    setError("");
    setNotice(msg);
  }

  function fail(msg: string) {
    setNotice("");
    setError(msg);
  }

  function refresh(next: ServiceCall) {
    setCall(next);
  }

  function transition(to: ServiceCallStatus) {
    if (!call) return;
    const result = updateServiceCallStatus(call.id, to, "Matrix User");
    if (!result.ok) {
      fail(result.error);
      return;
    }
    if (to === "RESOLVED" && result.call.resolution.finalMachineStatus === "OPERATIONAL") {
      setMachineStatusOverride({
        machineId: result.call.machine.machineId,
        status: "ONLINE",
        clearedAlert: true,
      });
    }
    if (to === "RESOLVED" && result.call.resolution.finalMachineStatus === "OPERATIONAL_WITH_LIMITATIONS") {
      setMachineStatusOverride({
        machineId: result.call.machine.machineId,
        status: "DEGRADED",
        clearedAlert: true,
      });
    }
    refresh(result.call);
    show(`Status updated to ${getServiceCallStatusLabel(to)}.`);
    setConfirmAction(null);
  }

  function runPrimary(action: string, to: ServiceCallStatus) {
    if (to === "RESOLVED" || to === "CLOSED" || to === "CANCELLED") {
      setConfirmAction(action);
      return;
    }
    transition(to);
  }

  if (!call) {
    return (
      <MatrixCard title="Service Call Not Found">
        <p className="text-sm text-slate-400">
          No service call matches <span className="text-white">{serviceCallId}</span>.
        </p>
        <div className="mt-4">
          <MatrixButton href="/service-calls" variant="secondary" size="md">
            Back to Service Calls
          </MatrixButton>
        </div>
      </MatrixCard>
    );
  }

  const emergency =
    call.priority === "EMERGENCY" || call.problem.machineCurrentlyDown;

  const visibleNotes = call.notes.filter(
    (n) => canViewInternal || !n.internalOnly,
  );

  const activity = activityNewestFirst
    ? call.activity
    : [...call.activity].reverse();

  const inventoryHits = sampleInventoryItems.filter((item) => {
    const q = partQuery.trim().toLowerCase();
    if (!q) return false;
    return (
      item.partNumber.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
    );
  }).slice(0, 8);

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
        className={`rounded-xl border p-5 ${
          emergency
            ? "border-rose-500/50 bg-rose-500/10"
            : "border-slate-800 bg-slate-900/50"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Work Order
            </p>
            <h2 className="text-2xl font-bold text-white">
              {call.workOrderNumber}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {call.id} · Ticket {call.ticketNumber}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {call.machine.printerModel} · {call.machine.assetTag} ·{" "}
              {call.machine.customerName} / {call.machine.siteName}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Tech: {call.assignment.technician || "Unassigned"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MatrixStatusBadge
              variant={getServiceCallPriorityBadgeVariant(call.priority)}
              label={getServiceCallPriorityLabel(call.priority)}
              className={getServiceCallPriorityBadgeClassName(call.priority)}
            />
            <MatrixStatusBadge
              variant={getServiceCallStatusBadgeVariant(call.status)}
              label={getServiceCallStatusLabel(call.status)}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {allowed.includes("ACCEPTED") && (
            <MatrixButton
              size="lg"
              variant="primary"
              onClick={() => runPrimary("accept", "ACCEPTED")}
            >
              Accept Call
            </MatrixButton>
          )}
          {allowed.includes("EN_ROUTE") && (
            <MatrixButton
              size="lg"
              variant="primary"
              onClick={() => transition("EN_ROUTE")}
            >
              Start Travel
            </MatrixButton>
          )}
          {allowed.includes("ON_SITE") && (
            <MatrixButton
              size="lg"
              variant="primary"
              onClick={() => transition("ON_SITE")}
            >
              Mark On Site
            </MatrixButton>
          )}
          {allowed.includes("DIAGNOSING") && (
            <MatrixButton
              size="lg"
              variant="secondary"
              onClick={() => transition("DIAGNOSING")}
            >
              Start Diagnosis
            </MatrixButton>
          )}
          {allowed.includes("WAITING_FOR_PARTS") && (
            <MatrixButton
              size="lg"
              variant="warning"
              onClick={() => transition("WAITING_FOR_PARTS")}
            >
              Wait for Parts
            </MatrixButton>
          )}
          {allowed.includes("RESOLVED") && (
            <MatrixButton
              size="lg"
              variant="success"
              onClick={() => runPrimary("resolve", "RESOLVED")}
            >
              Resolve Call
            </MatrixButton>
          )}
          {allowed.includes("CLOSED") && (
            <MatrixButton
              size="lg"
              variant="success"
              onClick={() => runPrimary("close", "CLOSED")}
            >
              Close Call
            </MatrixButton>
          )}
          <MatrixButton
            size="lg"
            variant="secondary"
            onClick={() => setShowReassign((v) => !v)}
          >
            Reassign
          </MatrixButton>
          <MatrixButton
            href={`/service-calls/${call.id}/edit`}
            size="lg"
            variant="secondary"
          >
            Edit
          </MatrixButton>
          <MatrixButton
            href={`/digital-twin/${call.machine.machineId}`}
            size="lg"
            variant="secondary"
          >
            Open Digital Twin
          </MatrixButton>
          <MatrixButton href="/scanner" size="lg" variant="secondary">
            Open Scanner
          </MatrixButton>
          <MatrixButton
            href="/guided-diagram-ordering"
            size="lg"
            variant="secondary"
          >
            Open Parts Diagram
          </MatrixButton>
          <MatrixButton
            href="/parts-order-builder"
            size="lg"
            variant="secondary"
          >
            Create Parts Order
          </MatrixButton>
        </div>

        {showReassign && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-950 p-4">
            <label className="text-sm text-slate-300">
              Technician
              <select
                className={fieldClass}
                value={reassignTech}
                onChange={(e) => setReassignTech(e.target.value)}
              >
                <option value="">Select…</option>
                {digitalTwinTechnicians.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <MatrixButton
              size="md"
              variant="primary"
              onClick={() => {
                const result = reassignServiceCall(
                  call.id,
                  reassignTech,
                  "Matrix User",
                );
                if (!result.ok) {
                  fail(result.error);
                  return;
                }
                refresh(result.call);
                show(`Reassigned to ${reassignTech}.`);
                setShowReassign(false);
              }}
            >
              Confirm Reassign
            </MatrixButton>
          </div>
        )}

        {confirmAction && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">
              Confirm {confirmAction === "resolve"
                ? "resolve"
                : confirmAction === "close"
                  ? "close"
                  : confirmAction}
              ?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MatrixButton
                size="md"
                variant="success"
                onClick={() => {
                  if (confirmAction === "resolve") transition("RESOLVED");
                  else if (confirmAction === "close") transition("CLOSED");
                  else if (confirmAction === "accept") transition("ACCEPTED");
                }}
              >
                Confirm
              </MatrixButton>
              <MatrixButton
                size="md"
                variant="secondary"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </MatrixButton>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              tab === t.id
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MatrixCard title="Machine">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ["Machine ID", call.machine.machineId],
                ["Asset", call.machine.assetTag],
                ["Serial", call.machine.serialNumber],
                ["Model", call.machine.printerModel],
                ["Nickname", call.machine.nickname],
                ["Customer", call.machine.customerName],
                ["Site", call.machine.siteName],
                ["Location", call.machine.machineLocation],
                ["Meter", String(call.machine.currentMeterCount)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </MatrixCard>
          <MatrixCard title="Problem">
            <p className="text-lg font-semibold text-white">
              {call.problem.issueTitle}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              {call.problem.problemDescription}
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Type: {getServiceCallTypeLabel(call.serviceType)} · Error:{" "}
              {call.problem.errorCode || "—"}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Impact: {call.problem.customerImpact || "—"}
            </p>
          </MatrixCard>
          <MatrixCard title="Contact">
            <p className="text-sm text-slate-300">
              {call.contact.reportedBy}
              <br />
              {call.contact.reporterPhone || "—"}
              <br />
              {call.contact.reporterEmail || "—"}
            </p>
          </MatrixCard>
          <MatrixCard title="Assignment & Schedule">
            <p className="text-sm text-slate-300">
              Tech: {call.assignment.technician || "Unassigned"}
              <br />
              Manager: {call.assignment.serviceManager}
              <br />
              Org / Region: {call.assignment.organization} /{" "}
              {call.assignment.region}
              <br />
              Requested: {call.schedule.requestedServiceDate || "—"}
              <br />
              Scheduled:{" "}
              {(call.schedule.scheduledStart || "—").replace("T", " ").slice(0, 16)}
            </p>
          </MatrixCard>
          <MatrixCard title="Status timeline">
            <ol className="space-y-2 text-sm">
              {call.activity.slice(0, 6).map((a) => (
                <li key={a.id} className="border-l-2 border-cyan-500/40 pl-3">
                  <p className="text-white">{a.description}</p>
                  <p className="text-xs text-slate-500">
                    {a.user} · {a.timestamp.replace("T", " ").slice(0, 19)}
                  </p>
                </li>
              ))}
            </ol>
          </MatrixCard>
        </div>
      )}

      {tab === "activity" && (
        <MatrixCard title="Activity timeline">
          <div className="mb-4">
            <MatrixButton
              size="sm"
              variant="secondary"
              onClick={() => setActivityNewestFirst((v) => !v)}
            >
              Show {activityNewestFirst ? "oldest" : "newest"} first
            </MatrixButton>
          </div>
          <ol className="space-y-3">
            {activity.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                  {a.activityType}
                </p>
                <p className="mt-1 text-sm text-white">{a.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {a.user} · {a.timestamp}
                </p>
              </li>
            ))}
          </ol>
        </MatrixCard>
      )}

      {tab === "diagnosis" && (
        <MatrixSection title="Diagnosis & resolution">
          <MatrixCard title="Resolution fields">
            <div className="grid gap-4">
              {(
                [
                  ["diagnosis", "Diagnosis"],
                  ["rootCause", "Root cause"],
                  ["workPerformed", "Work performed"],
                  ["resolutionSummary", "Resolution summary"],
                  ["technicianRecommendations", "Recommendations"],
                  ["technicianName", "Technician name"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm text-slate-300">
                  {label}
                  <textarea
                    className={fieldClass}
                    value={call.resolution[key]}
                    onChange={(e) => {
                      const next = {
                        ...call,
                        resolution: {
                          ...call.resolution,
                          [key]: e.target.value,
                        },
                      };
                      setCall(next);
                    }}
                  />
                </label>
              ))}
              <label className="block text-sm text-slate-300">
                Final machine status
                <select
                  className={fieldClass}
                  value={call.resolution.finalMachineStatus}
                  onChange={(e) =>
                    setCall({
                      ...call,
                      resolution: {
                        ...call.resolution,
                        finalMachineStatus: e.target
                          .value as FinalMachineStatus | "",
                      },
                    })
                  }
                >
                  <option value="">Select…</option>
                  {FINAL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Completion timestamp
                <input
                  type="datetime-local"
                  className={fieldClass}
                  value={call.resolution.completedAt.slice(0, 16)}
                  onChange={(e) =>
                    setCall({
                      ...call,
                      resolution: {
                        ...call.resolution,
                        completedAt: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : "",
                      },
                    })
                  }
                />
              </label>
              <MatrixButton
                size="md"
                variant="primary"
                onClick={() => {
                  const result = updateServiceCallResolution(
                    call.id,
                    call.resolution,
                    "Matrix User",
                  );
                  if (!result.ok) {
                    fail(result.error);
                    return;
                  }
                  refresh(result.call);
                  show("Resolution saved (local session).");
                }}
              >
                Save Resolution
              </MatrixButton>
            </div>
          </MatrixCard>
        </MatrixSection>
      )}

      {tab === "parts" && (
        <div className="space-y-4">
          <MatrixCard title="Parts on this call">
            {call.parts.length === 0 ? (
              <p className="text-sm text-slate-500">No parts linked yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {call.parts.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-lg border border-slate-800 px-3 py-2"
                  >
                    <span className="font-semibold text-cyan-300">
                      {p.partNumber}
                    </span>{" "}
                    — {p.description} × {p.quantity}
                    {p.emergency ? (
                      <span className="ml-2 text-rose-300">EMERGENCY</span>
                    ) : null}
                    <span className="ml-2 text-slate-500">
                      {p.stockSource} · {p.orderStatus}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </MatrixCard>
          <MatrixCard title="Search inventory / add part">
            <input
              className={fieldClass}
              placeholder="Search part number or description…"
              value={partQuery}
              onChange={(e) => setPartQuery(e.target.value)}
            />
            <ul className="mt-3 space-y-2">
              {inventoryHits.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold text-white">{item.partNumber}</p>
                    <p className="text-slate-400">{item.description}</p>
                    <p className="text-xs text-slate-500">
                      {item.locationLabel} · {item.stockStatus}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MatrixButton
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const result = addServiceCallPart(
                          call.id,
                          {
                            partNumber: item.partNumber,
                            description: item.description,
                            quantity: 1,
                            required: true,
                            used: false,
                            ordered: false,
                            orderStatus: "NOT_ORDERED",
                            emergency: false,
                            stockSource:
                              item.locationType === "truck"
                                ? "truck"
                                : "warehouse",
                          },
                          "Matrix User",
                        );
                        if (!result.ok) {
                          fail(result.error);
                          return;
                        }
                        refresh(result.call);
                        show(`Added required part ${item.partNumber}.`);
                      }}
                    >
                      Mark Required
                    </MatrixButton>
                    <MatrixButton
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const result = addServiceCallPart(
                          call.id,
                          {
                            partNumber: item.partNumber,
                            description: item.description,
                            quantity: 1,
                            required: false,
                            used: true,
                            ordered: false,
                            orderStatus: "INSTALLED",
                            emergency: false,
                            stockSource:
                              item.locationType === "truck"
                                ? "truck"
                                : "warehouse",
                          },
                          "Matrix User",
                        );
                        if (!result.ok) {
                          fail(result.error);
                          return;
                        }
                        refresh(result.call);
                        show(`Recorded part used: ${item.partNumber}.`);
                      }}
                    >
                      Add Used
                    </MatrixButton>
                    <MatrixButton
                      size="sm"
                      variant="warning"
                      onClick={() => {
                        const result = addServiceCallPart(
                          call.id,
                          {
                            partNumber: item.partNumber,
                            description: item.description,
                            quantity: 1,
                            required: true,
                            used: false,
                            ordered: false,
                            orderStatus: "NOT_ORDERED",
                            emergency: true,
                            stockSource: "unknown",
                          },
                          "Matrix User",
                        );
                        if (!result.ok) {
                          fail(result.error);
                          return;
                        }
                        refresh(result.call);
                        show(`Emergency part need flagged: ${item.partNumber}.`);
                      }}
                    >
                      Emergency
                    </MatrixButton>
                    <MatrixButton
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        const line = createServiceCallPartsOrderDraftLine({
                          item,
                          quantity: 1,
                          serviceCallId: call.id,
                          workOrderNumber: call.workOrderNumber,
                          machineId: call.machine.machineId,
                          assetTag: call.machine.assetTag,
                          printerModel: call.machine.printerModel,
                          emergency: emergency,
                          orderReason: call.problem.issueTitle,
                        });
                        setPartsDraft((prev) => [line, ...prev]);
                        const result = addServiceCallPart(
                          call.id,
                          {
                            partNumber: item.partNumber,
                            description: item.description,
                            quantity: 1,
                            required: true,
                            used: false,
                            ordered: true,
                            orderStatus: "DRAFT",
                            emergency: emergency,
                            stockSource: "ordered",
                          },
                          "Matrix User",
                        );
                        if (result.ok) refresh(result.call);
                        show(
                          `Added ${item.partNumber} to parts-order draft (local session).`,
                        );
                      }}
                    >
                      Add to Order Draft
                    </MatrixButton>
                  </div>
                </li>
              ))}
            </ul>
            {partsDraft.length > 0 && (
              <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3 text-sm text-cyan-100">
                <p className="font-semibold">
                  Parts-order draft ({partsDraft.length}) — local session
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {partsDraft.map((d) => (
                    <li key={d.id}>
                      {d.partNumber} × {d.quantity} · WO {d.workOrderNumber} ·{" "}
                      {d.machineId}
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <MatrixButton
                    href="/parts-order-builder"
                    size="sm"
                    variant="secondary"
                  >
                    Open Parts Order Builder
                  </MatrixButton>
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <MatrixButton
                href="/guided-diagram-ordering"
                size="md"
                variant="secondary"
              >
                Open Machine Diagram
              </MatrixButton>
              <MatrixButton
                href="/diagram-part-detail"
                size="md"
                variant="secondary"
              >
                Diagram Part Detail
              </MatrixButton>
              <MatrixButton href="/inventory" size="md" variant="secondary">
                Inventory
              </MatrixButton>
            </div>
          </MatrixCard>
        </div>
      )}

      {tab === "schedule" && (
        <MatrixCard title="Schedule">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Requested", call.schedule.requestedServiceDate],
              ["Scheduled start", call.schedule.scheduledStart],
              ["Scheduled end", call.schedule.scheduledEnd],
              ["Arrival", call.schedule.arrivalDateTime],
              ["Departure", call.schedule.departureDateTime],
              [
                "Estimated hours",
                String(call.schedule.estimatedDurationHours),
              ],
              ["Actual labor hours", String(call.schedule.actualLaborHours)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-white">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </MatrixCard>
      )}

      {tab === "notes" && (
        <div className="space-y-4">
          <MatrixCard title="Add note">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-slate-300">
                Note type
                <select
                  className={fieldClass}
                  value={noteType}
                  onChange={(e) =>
                    setNoteType(e.target.value as ServiceCallNoteType)
                  }
                >
                  {NOTE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 sm:mt-6">
                <input
                  type="checkbox"
                  checked={noteInternal}
                  onChange={(e) => setNoteInternal(e.target.checked)}
                  className="h-4 w-4"
                />
                Internal only
              </label>
              <label className="text-sm text-slate-300 sm:col-span-2">
                Note body
                <textarea
                  className={fieldClass + " min-h-[90px]"}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-3">
              <MatrixButton
                size="md"
                variant="primary"
                onClick={() => {
                  const result = addServiceCallNote(call.id, {
                    author: "Matrix User",
                    noteType,
                    body: noteBody,
                    internalOnly: noteInternal,
                  });
                  if (!result.ok) {
                    fail(result.error);
                    return;
                  }
                  refresh(result.call);
                  setNoteBody("");
                  show("Note added.");
                }}
              >
                Add Note
              </MatrixButton>
            </div>
          </MatrixCard>
          <MatrixCard title="Notes">
            {visibleNotes.length === 0 ? (
              <p className="text-sm text-slate-500">No visible notes.</p>
            ) : (
              <ul className="space-y-3">
                {visibleNotes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-slate-800 px-4 py-3 text-sm"
                  >
                    <p className="text-xs text-slate-500">
                      {n.noteType}
                      {n.internalOnly ? " · INTERNAL" : ""} · {n.author} ·{" "}
                      {n.createdAt}
                    </p>
                    <p className="mt-1 text-white">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </MatrixCard>
        </div>
      )}

      {tab === "customer" && (
        <MatrixCard title="Customer confirmation">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={call.customerConfirmation.completionAcknowledged}
              onChange={(e) => {
                const next = {
                  ...call,
                  customerConfirmation: {
                    ...call.customerConfirmation,
                    completionAcknowledged: e.target.checked,
                  },
                };
                setCall(next);
                replaceServiceCall(next);
              }}
              className="h-4 w-4"
            />
            Completion acknowledgement (placeholder)
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={call.customerConfirmation.managerOverrideClose}
              onChange={(e) => {
                const next = {
                  ...call,
                  customerConfirmation: {
                    ...call.customerConfirmation,
                    managerOverrideClose: e.target.checked,
                  },
                };
                setCall(next);
                replaceServiceCall(next);
              }}
              className="h-4 w-4"
            />
            Manager override close
          </label>
          <p className="mt-4 text-sm text-slate-500">
            Customer signature:{" "}
            {call.customerConfirmation.customerSignaturePlaceholder}
          </p>
          <p className="text-sm text-slate-500">
            Technician signature:{" "}
            {call.customerConfirmation.technicianSignaturePlaceholder}
          </p>
        </MatrixCard>
      )}

      {tab === "attachments" && (
        <MatrixCard title="Attachments">
          <ul className="space-y-2 text-sm text-slate-400">
            {call.attachments.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-center"
              >
                {a.label} — {a.description}
              </li>
            ))}
          </ul>
        </MatrixCard>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/service-calls" className="text-cyan-400 hover:text-cyan-300">
          Back to Service Calls
        </Link>
      </p>
    </div>
  );
}
