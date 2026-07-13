"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatusBadge,
} from "../components/ui";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import {
  addWorkOrderAttachment,
  addWorkOrderNote,
  addWorkOrderPart,
  assignWorkOrder,
  captureWorkOrderSignature,
  getAllowedWorkOrderTransitions,
  getWorkOrder,
  getWorkOrderPriorityLabel,
  getWorkOrderServiceTypeLabel,
  getWorkOrderStatusLabel,
  getWorkOrderTimelineLabel,
  listWorkOrderAudit,
  listWorkOrderTimeline,
  priorityBadgeVariant,
  recordWorkOrderCopyCount,
  runWorkOrderQuickAction,
  statusBadgeVariant,
  updateWorkOrderLabor,
  updateWorkOrderSchedule,
  updateWorkOrderStatus,
  type WorkOrder,
  type WorkOrderStatus,
} from "@/lib/work-orders";

type Props = {
  workOrderId: string;
};

export default function WorkOrderDetailPanel({ workOrderId }: Props) {
  const canUpdate = hasMatrixPermission(DEV_FALLBACK_ROLE, "UPDATE_WORK_ORDER");
  const canAssign = hasMatrixPermission(DEV_FALLBACK_ROLE, "ASSIGN_WORK_ORDER");
  const canComplete = hasMatrixPermission(DEV_FALLBACK_ROLE, "COMPLETE_WORK_ORDER");
  const canViewInternal = hasMatrixPermission(
    DEV_FALLBACK_ROLE,
    "VIEW_WORK_ORDER_INTERNAL_NOTES",
  );

  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [partDesc, setPartDesc] = useState("");
  const [hours, setHours] = useState("");
  const [fileName, setFileName] = useState("");
  const [signature, setSignature] = useState("");
  const [copyCount, setCopyCount] = useState("");
  const [tech, setTech] = useState("");
  const [schedStart, setSchedStart] = useState("");
  const [schedEnd, setSchedEnd] = useState("");

  const order = useMemo(() => {
    void tick;
    return getWorkOrder(workOrderId) ?? null;
  }, [workOrderId, tick]);

  const timeline = useMemo(() => {
    void tick;
    return order ? listWorkOrderTimeline(order.id) : [];
  }, [order, tick]);

  const audit = useMemo(() => {
    void tick;
    return order ? listWorkOrderAudit(order.id) : [];
  }, [order, tick]);

  function refresh(msg?: string) {
    setError("");
    if (msg) setNotice(msg);
    setTick((t) => t + 1);
  }

  function applyResult(
    result: { ok: true; workOrder: WorkOrder } | { ok: false; error: string },
    successMsg: string,
  ) {
    if (!result.ok) {
      setNotice("");
      setError(result.error);
      return;
    }
    refresh(successMsg);
  }

  if (!order) {
    return (
      <MatrixEmptyState
        title="Work order not found"
        description="It may have been removed from the local session store."
      />
    );
  }

  const transitions = getAllowedWorkOrderTransitions(order.status);

  return (
    <div className="space-y-6">
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

      <MatrixCard
        title={order.workOrderNumber}
        subtitle={order.title}
        actions={
          <div className="flex flex-wrap gap-2">
            <MatrixStatusBadge
              variant={priorityBadgeVariant(order.priority)}
              label={getWorkOrderPriorityLabel(order.priority)}
            />
            <MatrixStatusBadge
              variant={statusBadgeVariant(order.status)}
              label={getWorkOrderStatusLabel(order.status)}
            />
          </div>
        }
      >
        <p className="text-sm text-slate-300">{order.description}</p>
        {canUpdate && (
          <div className="mt-4 flex flex-wrap gap-2">
            <MatrixButton
              size="sm"
              variant="primary"
              onClick={() =>
                applyResult(
                  runWorkOrderQuickAction({
                    workOrderId: order.id,
                    action: "start",
                    actor: "Matrix User",
                  }),
                  "Work started.",
                )
              }
            >
              Start Work
            </MatrixButton>
            <MatrixButton
              size="sm"
              variant="secondary"
              onClick={() =>
                applyResult(
                  runWorkOrderQuickAction({
                    workOrderId: order.id,
                    action: "pause",
                    actor: "Matrix User",
                  }),
                  "Work paused.",
                )
              }
            >
              Pause Work
            </MatrixButton>
            <MatrixButton
              size="sm"
              variant="secondary"
              onClick={() =>
                applyResult(
                  runWorkOrderQuickAction({
                    workOrderId: order.id,
                    action: "resume",
                    actor: "Matrix User",
                  }),
                  "Work resumed.",
                )
              }
            >
              Resume Work
            </MatrixButton>
            {canComplete && (
              <MatrixButton
                size="sm"
                variant="success"
                onClick={() =>
                  applyResult(
                    runWorkOrderQuickAction({
                      workOrderId: order.id,
                      action: "complete",
                      actor: "Matrix User",
                    }),
                    "Work completed.",
                  )
                }
              >
                Complete Work
              </MatrixButton>
            )}
          </div>
        )}
      </MatrixCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <MatrixCard title="General Information">
          <dl className="space-y-2 text-sm">
            <Row label="Service Type" value={getWorkOrderServiceTypeLabel(order.serviceType)} />
            <Row label="Source" value={order.source} />
            <Row label="Requested By" value={order.requestedBy} />
            <Row label="Created By" value={order.createdBy} />
            <Row label="Created" value={order.createdAt.slice(0, 19).replace("T", " ")} />
          </dl>
        </MatrixCard>

        <MatrixCard title="Customer / Site">
          <dl className="space-y-2 text-sm">
            <Row label="Customer" value={order.customerName} />
            <Row label="Site" value={order.siteName} />
            <Row label="Address" value={order.siteAddress || "—"} />
            <Row label="Region" value={order.region || "—"} />
          </dl>
        </MatrixCard>

        <MatrixCard title="Printer Information">
          <dl className="space-y-2 text-sm">
            <Row label="Printer" value={order.printerName || "—"} />
            <Row label="Model" value={order.printerModel || "—"} />
            <Row label="Asset" value={order.assetTag || "—"} />
            {order.printerId && (
              <div className="pt-2">
                <Link
                  href={`/digital-twin/${order.printerId}`}
                  className="text-cyan-300 hover:text-cyan-200"
                >
                  Open Digital Twin
                </Link>
              </div>
            )}
          </dl>
        </MatrixCard>

        <MatrixCard title="Service Details / Schedule">
          <dl className="space-y-2 text-sm">
            <Row label="Assigned" value={order.assignedTechnician || "Unassigned"} />
            <Row label="Secondary" value={order.secondaryTechnician || "—"} />
            <Row label="Scheduled Start" value={(order.scheduledStart ?? "—").slice(0, 16)} />
            <Row label="Scheduled End" value={(order.scheduledEnd ?? "—").slice(0, 16)} />
            <Row label="Actual Start" value={(order.actualStart ?? "—").slice(0, 16)} />
            <Row label="Actual End" value={(order.actualEnd ?? "—").slice(0, 16)} />
            <Row label="Est. Hours" value={String(order.estimatedHours ?? "—")} />
          </dl>
          {canAssign && (
            <div className="mt-4 space-y-2">
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Assign technician"
                value={tech}
                onChange={(e) => setTech(e.target.value)}
              />
              <MatrixButton
                size="sm"
                variant="secondary"
                onClick={() =>
                  applyResult(
                    assignWorkOrder({
                      workOrderId: order.id,
                      technician: tech || "Toby Tompkins",
                      actor: "Matrix Manager",
                    }),
                    "Technician assigned.",
                  )
                }
              >
                Assign / Reassign
              </MatrixButton>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="datetime-local"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={schedStart}
                  onChange={(e) => setSchedStart(e.target.value)}
                />
                <input
                  type="datetime-local"
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                  value={schedEnd}
                  onChange={(e) => setSchedEnd(e.target.value)}
                />
              </div>
              <MatrixButton
                size="sm"
                variant="secondary"
                onClick={() =>
                  applyResult(
                    updateWorkOrderSchedule({
                      workOrderId: order.id,
                      scheduledStart: schedStart
                        ? new Date(schedStart).toISOString()
                        : null,
                      scheduledEnd: schedEnd
                        ? new Date(schedEnd).toISOString()
                        : null,
                      actor: "Matrix Manager",
                    }),
                    "Schedule updated.",
                  )
                }
              >
                Edit Schedule
              </MatrixButton>
            </div>
          )}
        </MatrixCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MatrixCard title="Copy Counts">
          <dl className="space-y-2 text-sm">
            <Row
              label="At Start"
              value={
                order.copyCountAtStart == null
                  ? "—"
                  : order.copyCountAtStart.toLocaleString("en-US")
              }
            />
            <Row
              label="At End"
              value={
                order.copyCountAtEnd == null
                  ? "—"
                  : order.copyCountAtEnd.toLocaleString("en-US")
              }
            />
          </dl>
          {canUpdate && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="number"
                min={0}
                className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Copy count"
                value={copyCount}
                onChange={(e) => setCopyCount(e.target.value)}
              />
              <MatrixButton
                size="sm"
                variant="secondary"
                onClick={() =>
                  applyResult(
                    recordWorkOrderCopyCount({
                      workOrderId: order.id,
                      copyCount: Number(copyCount),
                      at: "start",
                      actor: "Matrix User",
                    }),
                    "Start copy count saved.",
                  )
                }
              >
                Record Start
              </MatrixButton>
              <MatrixButton
                size="sm"
                variant="secondary"
                onClick={() =>
                  applyResult(
                    recordWorkOrderCopyCount({
                      workOrderId: order.id,
                      copyCount: Number(copyCount),
                      at: "end",
                      actor: "Matrix User",
                    }),
                    "End copy count saved.",
                  )
                }
              >
                Record End
              </MatrixButton>
            </div>
          )}
        </MatrixCard>

        <MatrixCard title="Labor / Travel">
          <dl className="space-y-2 text-sm">
            <Row label="Actual Hours" value={String(order.actualHours ?? "—")} />
            <Row label="Travel Time" value={String(order.travelTime ?? "—")} />
            <Row label="Mileage" value={String(order.mileage ?? "—")} />
            <Row label="Labor Rate" value={String(order.laborRate ?? "—")} />
            <Row label="Labor Cost" value={String(order.laborCost ?? "—")} />
          </dl>
          {canUpdate && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="number"
                min={0}
                step={0.25}
                className="w-32 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Hours"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              <MatrixButton
                size="sm"
                variant="secondary"
                onClick={() =>
                  applyResult(
                    updateWorkOrderLabor({
                      workOrderId: order.id,
                      actualHours: Number(hours),
                      actor: "Matrix User",
                    }),
                    "Labor updated.",
                  )
                }
              >
                Update Labor
              </MatrixButton>
            </div>
          )}
        </MatrixCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MatrixCard title="Parts Used">
          <ul className="space-y-2 text-sm">
            {order.parts.length === 0 ? (
              <li className="text-slate-500">No parts recorded</li>
            ) : (
              order.parts.map((p) => (
                <li key={p.id}>
                  {p.partNumber} · {p.description} × {p.quantity}
                </li>
              ))
            )}
          </ul>
          {canUpdate && (
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Part number"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Description"
                value={partDesc}
                onChange={(e) => setPartDesc(e.target.value)}
              />
              <MatrixButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  applyResult(
                    addWorkOrderPart({
                      workOrderId: order.id,
                      partNumber,
                      description: partDesc,
                      quantity: 1,
                      actor: "Matrix User",
                    }),
                    "Part added.",
                  );
                  setPartNumber("");
                  setPartDesc("");
                }}
              >
                Add Parts
              </MatrixButton>
            </div>
          )}
        </MatrixCard>

        <MatrixCard title="Photos / Files">
          <ul className="space-y-2 text-sm">
            {order.attachments.length === 0 ? (
              <li className="text-slate-500">No attachments</li>
            ) : (
              order.attachments.map((a) => (
                <li key={a.id}>
                  [{a.kind}] {a.fileName} · {a.uploadedBy}
                </li>
              ))
            )}
          </ul>
          {canUpdate && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="file-name.pdf or photo.jpg"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
              <MatrixButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  const isPhoto = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
                  applyResult(
                    addWorkOrderAttachment({
                      workOrderId: order.id,
                      kind: isPhoto
                        ? "PHOTO"
                        : fileName.toLowerCase().endsWith(".pdf")
                          ? "PDF"
                          : "SERVICE_DOCUMENT",
                      fileName,
                      actor: "Matrix User",
                    }),
                    "Attachment metadata saved.",
                  );
                  setFileName("");
                }}
              >
                Upload Photos / Files
              </MatrixButton>
            </div>
          )}
        </MatrixCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MatrixCard title="Notes">
          <p className="whitespace-pre-wrap text-sm text-slate-300">
            {order.notes || "No customer-visible notes."}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Customer visible: {order.customerVisibleNotes || "—"}
          </p>
          {canViewInternal && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-amber-200/80">
              Internal: {order.internalNotes || "—"}
            </p>
          )}
          {canUpdate && (
            <div className="mt-3 space-y-2">
              <textarea
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add notes"
              />
              <div className="flex gap-2">
                <MatrixButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    applyResult(
                      addWorkOrderNote({
                        workOrderId: order.id,
                        note,
                        actor: "Matrix User",
                      }),
                      "Note added.",
                    );
                    setNote("");
                  }}
                >
                  Add Notes
                </MatrixButton>
                {canViewInternal && (
                  <MatrixButton
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      applyResult(
                        addWorkOrderNote({
                          workOrderId: order.id,
                          note,
                          internal: true,
                          actor: "Matrix User",
                        }),
                        "Internal note added.",
                      );
                      setNote("");
                    }}
                  >
                    Add Internal Note
                  </MatrixButton>
                )}
              </div>
            </div>
          )}
        </MatrixCard>

        <MatrixCard title="Customer Signature">
          <p className="text-sm text-slate-300">
            {order.customerSignature
              ? `${order.customerSignature} · ${order.signatureCapturedAt?.slice(0, 19)}`
              : "No signature captured"}
          </p>
          {canUpdate && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Customer printed name"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
              />
              <MatrixButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  applyResult(
                    captureWorkOrderSignature({
                      workOrderId: order.id,
                      signatureName: signature,
                      actor: "Matrix User",
                    }),
                    "Signature captured.",
                  );
                  setSignature("");
                }}
              >
                Capture Signature
              </MatrixButton>
            </div>
          )}
        </MatrixCard>
      </div>

      {canUpdate && transitions.length > 0 && (
        <MatrixCard title="Status Transitions">
          <div className="flex flex-wrap gap-2">
            {transitions.map((status) => (
              <MatrixButton
                key={status}
                size="sm"
                variant="secondary"
                onClick={() =>
                  applyResult(
                    updateWorkOrderStatus({
                      workOrderId: order.id,
                      status: status as WorkOrderStatus,
                      actor: "Matrix User",
                    }),
                    `Status → ${getWorkOrderStatusLabel(status)}`,
                  )
                }
              >
                {getWorkOrderStatusLabel(status)}
              </MatrixButton>
            ))}
          </div>
        </MatrixCard>
      )}

      <MatrixCard title="Timeline" subtitle="Newest activity first">
        <ul className="space-y-3">
          {timeline.length === 0 ? (
            <li className="text-sm text-slate-500">No timeline events yet</li>
          ) : (
            timeline.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm"
              >
                <p className="font-semibold text-white">
                  {getWorkOrderTimelineLabel(e.type)} · {e.title}
                </p>
                <p className="text-slate-400">{e.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {e.actor} · {e.occurredAt.slice(0, 19).replace("T", " ")}
                  {e.previousValue
                    ? ` · ${e.previousValue} → ${e.newValue}`
                    : ""}
                </p>
              </li>
            ))
          )}
        </ul>
      </MatrixCard>

      <MatrixCard title="Audit Trail">
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {audit.length === 0 ? (
            <li className="text-slate-500">No audit entries</li>
          ) : (
            audit.map((a) => (
              <li key={a.id} className="text-slate-400">
                <span className="text-slate-200">{a.action}</span> · {a.field}:{" "}
                {a.previousValue || "∅"} → {a.newValue || "∅"} · {a.actor} ·{" "}
                {a.occurredAt.slice(0, 19).replace("T", " ")}
              </li>
            ))
          )}
        </ul>
      </MatrixCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-200">{value}</dd>
    </div>
  );
}
