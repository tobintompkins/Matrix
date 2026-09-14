"use client";
import { useFieldIdentity } from "@/app/field/FieldIdentityProvider";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import FieldShell from "../../FieldShell";
import {
  applyWorkSessionAction,
  buildCompletionChecklist,
  downloadWorkOrderPackage,
  enqueueOperation,
  formatDurationMs,
  getOfflinePackage,
  getSessionForWorkOrder,
  isOfflineLike,
  getConnectivityService,
  removeOfflinePackage,
  sessionActionRequiresReason,
  type ConnectivityStatus,
  type OfflinePackage,
  type WorkSession,
  type WorkSessionAction,
} from "@/lib/field";
import {
  getWorkOrder,
  getWorkOrderPriorityLabel,
  getWorkOrderStatusLabel,
  listWorkOrderTimeline,
} from "@/lib/work-orders";


function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-xl border border-slate-800 bg-slate-900"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex min-h-10 items-center justify-between gap-2">
          {title}
          <span className="text-slate-500" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-300">
        {children}
      </div>
    </details>
  );
}

const SESSION_ACTIONS: WorkSessionAction[] = [
  "BEGIN_TRAVEL",
  "ARRIVE_ON_SITE",
  "START_WORK",
  "PAUSE_WORK",
  "RESUME_WORK",
  "WAITING_FOR_PARTS",
  "WAITING_FOR_CUSTOMER",
  "COMPLETE_WORK",
];

export default function FieldWorkDetailPage() {
  const { technicianName: TECH, userId: TECH_ID } = useFieldIdentity();
  const params = useParams();
  const workOrderId = String(params.workOrderId ?? "");
  const [tick, setTick] = useState(0);
  const [session, setSession] = useState<WorkSession | null>(null);
  const [pkg, setPkg] = useState<OfflinePackage | null>(null);
  const [status, setStatus] = useState<ConnectivityStatus>("ONLINE");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [sigName, setSigName] = useState("");
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    return getConnectivityService().subscribe(setStatus);
  }, []);

  useEffect(() => {
    void getSessionForWorkOrder(workOrderId, TECH_ID).then(setSession);
    void getOfflinePackage(workOrderId, TECH_ID).then(setPkg);
  }, [workOrderId, tick, TECH_ID]);

  const order = useMemo(() => {
    void tick;
    return getWorkOrder(workOrderId);
  }, [workOrderId, tick]);

  const timeline = useMemo(() => {
    void tick;
    return order ? listWorkOrderTimeline(order.id) : [];
  }, [order, tick]);

  const checklist = useMemo(() => {
    if (!order) {
      return null;
    }
    return buildCompletionChecklist({
      workOrder: order,
      hasSignatureOrDecline: Boolean(order.customerSignature || declineReason),
      hasPhotos: order.attachments.length > 0,
      maintenanceRequired: ["PREVENTIVE_MAINTENANCE", "CLEANING", "JOINT_UNIT", "DTF_PM"].includes(
        String(order.serviceType),
      ),
      maintenanceDone: false,
      unsyncedCount: 0,
      followUpRecorded: true,
    });
  }, [order, declineReason]);

  if (!order) {
    return (
      <FieldShell title="Work Order">
        <p className="text-slate-400">Work order not found.</p>
        <Link href="/field/work" className="mt-4 inline-block text-cyan-400">
          Back to list
        </Link>
      </FieldShell>
    );
  }

  const wo = order;

  async function runSession(action: WorkSessionAction) {
    if (sessionActionRequiresReason(action) && !reason.trim()) {
      setNotice("Enter a reason before continuing.");
      return;
    }
    const result = await applyWorkSessionAction({
      workOrderId: wo.id,
      technicianId: TECH_ID,
      technicianName: TECH,
      action,
      reason,
    });
    if (!result.ok) {
      setNotice(result.error ?? "Session action failed");
      return;
    }

    const statusMap: Partial<Record<WorkSessionAction, string>> = {
      BEGIN_TRAVEL: "TRAVELING",
      ARRIVE_ON_SITE: "ON_SITE",
      START_WORK: "ON_SITE",
      PAUSE_WORK: "ON_HOLD",
      RESUME_WORK: "ON_SITE",
      WAITING_FOR_PARTS: "WAITING_FOR_PARTS",
      WAITING_FOR_CUSTOMER: "WAITING_FOR_CUSTOMER",
    };

    await enqueueOperation({
      type: "WORK_SESSION",
      userId: TECH_ID,
      technicianName: TECH,
      workOrderId: wo.id,
      payload: {
        action,
        reason,
        status: statusMap[action],
        quickAction:
          action === "START_WORK" || action === "RESUME_WORK"
            ? "start"
            : action === "PAUSE_WORK"
              ? "pause"
              : action === "COMPLETE_WORK"
                ? "complete"
                : undefined,
        downloadedRevision: wo.updatedAt,
      },
    });

    if (statusMap[action]) {
      await enqueueOperation({
        type: "STATUS_CHANGE",
        userId: TECH_ID,
        technicianName: TECH,
        workOrderId: wo.id,
        payload: {
          status: statusMap[action],
          note: reason || action,
          downloadedRevision: wo.updatedAt,
        },
      });
    }

    setReason("");
    setNotice(`${action.replaceAll("_", " ")} recorded${isOfflineLike(status) ? " (queued offline)" : ""}.`);
    setTick((t) => t + 1);
  }

  async function saveNote() {
    if (!note.trim()) return;
    await enqueueOperation({
      type: "NOTE",
      userId: TECH_ID,
      technicianName: TECH,
      workOrderId: wo.id,
      payload: { note },
    });
    setNote("");
    setNotice("Note queued.");
    setTick((t) => t + 1);
  }

  async function saveSignature(declined: boolean) {
    if (declined && !declineReason.trim()) {
      setNotice("Decline reason is required.");
      return;
    }
    if (!declined && !sigName.trim()) {
      setNotice("Customer name is required for signature.");
      return;
    }
    await enqueueOperation({
      type: "SIGNATURE",
      userId: TECH_ID,
      technicianName: TECH,
      workOrderId: wo.id,
      payload: {
        declined,
        declineReason,
        customerName: sigName,
        signedAt: new Date().toISOString(),
        workOrderNumber: wo.workOrderNumber,
        technicianName: TECH,
      },
    });
    setNotice(declined ? "Signature decline queued." : "Signature queued.");
    setTick((t) => t + 1);
  }

  async function completeOffline() {
    if (!checklist?.ready) {
      setNotice(`Complete required items: ${checklist?.missing.join(", ")}`);
      return;
    }
    await enqueueOperation({
      type: "COMPLETION",
      userId: TECH_ID,
      technicianName: TECH,
      workOrderId: wo.id,
      payload: {
        resolution: wo.notes || "Completed in field",
        completedOffline: true,
      },
    });
    setNotice("Completed Offline – Pending Sync");
    setShowComplete(false);
    setTick((t) => t + 1);
  }

  return (
    <FieldShell title={wo.workOrderNumber}>
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs text-slate-400">
          {getWorkOrderPriorityLabel(wo.priority)} ·{" "}
          {getWorkOrderStatusLabel(wo.status)}
        </p>
        <h2 className="mt-1 text-xl font-bold">{wo.customerName}</h2>
        <p className="text-sm text-slate-400">{wo.siteName}</p>
        <p className="mt-2 text-sm text-slate-300">{wo.siteAddress}</p>
        {pkg && (
          <p className="mt-2 text-xs text-cyan-300">
            Offline package ready · {new Date(pkg.downloadedAt).toLocaleString()} ·{" "}
            {Math.round(pkg.sizeBytes / 1024)} KB
            {pkg.readiness === "STALE" ? " · stale" : ""}
          </p>
        )}
      </div>

      {notice && (
        <p className="mb-4 rounded-xl border border-cyan-800/50 bg-cyan-950/40 px-4 py-3 text-sm text-cyan-100" role="status">
          {notice}
        </p>
      )}

      <div className="mb-4 space-y-2">
        <label className="block text-xs text-slate-400" htmlFor="session-reason">
          Reason (required for pause / waiting)
        </label>
        <input
          id="session-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-white"
          placeholder="Reason…"
        />
        <div className="grid grid-cols-2 gap-2">
          {SESSION_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => void runSession(action)}
              className="min-h-12 rounded-xl border border-slate-600 bg-slate-900 px-2 text-xs font-semibold text-slate-100 hover:border-cyan-500"
            >
              {action.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        {session && (
          <p className="text-xs text-slate-500">
            Travel {formatDurationMs(session.totalTravelMs)} · Labor{" "}
            {formatDurationMs(session.totalLaborMs)} · Paused{" "}
            {formatDurationMs(session.totalPausedMs)}
            {session.active ? " · Active session" : ""}
          </p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-semibold"
          onClick={() =>
            void downloadWorkOrderPackage({
              workOrder: order,
              technicianId: TECH_ID,
            }).then(() => {
              setNotice("Offline package downloaded.");
              setTick((t) => t + 1);
            })
          }
        >
          Download Offline
        </button>
        {pkg && (
          <button
            type="button"
            className="min-h-11 rounded-lg border border-rose-700 px-3 text-xs font-semibold text-rose-300"
            onClick={() => {
              if (!window.confirm("Remove offline copy?")) return;
              void removeOfflinePackage(pkg.id, TECH_ID, true).then(() => {
                setNotice("Offline copy removed.");
                setTick((t) => t + 1);
              });
            }}
          >
            Remove Offline Copy
          </button>
        )}
        <Link
          href={`/field/copy-count?workOrderId=${wo.id}&printerId=${wo.printerId ?? ""}`}
          className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-semibold leading-[2.75rem]"
        >
          Copy Count
        </Link>
        <Link
          href={`/field/parts?workOrderId=${wo.id}`}
          className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-semibold leading-[2.75rem]"
        >
          Parts
        </Link>
        <Link
          href={`/field/maintenance?workOrderId=${wo.id}&printerId=${wo.printerId ?? ""}`}
          className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-semibold leading-[2.75rem]"
        >
          Maintenance
        </Link>
      </div>

      <div className="space-y-3">
        <Section title="Job Summary" defaultOpen>
          <p className="font-medium text-white">{wo.title}</p>
          <p className="mt-2">{wo.description}</p>
        </Section>
        <Section title="Customer and Site">
          <p>{wo.customerName}</p>
          <p>{wo.siteName}</p>
          <p>{wo.siteAddress}</p>
          <p className="text-slate-500">{wo.region}</p>
        </Section>
        <Section title="Printer Information">
          <p>{wo.printerName ?? "—"}</p>
          <p>Model: {wo.printerModel ?? "—"}</p>
          <p>Asset: {wo.assetTag ?? "—"}</p>
          {wo.printerId && (
            <Link
              href={`/field/printers/${wo.printerId}`}
              className="mt-2 inline-block text-cyan-400"
            >
              Printer quick view
            </Link>
          )}
        </Section>
        <Section title="Reported Problem">{wo.description || "—"}</Section>
        <Section title="Service History">
          {timeline.length === 0 ? (
            <p className="text-slate-500">No timeline events.</p>
          ) : (
            <ul className="space-y-2">
              {timeline.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <p className="font-medium text-white">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(e.occurredAt).toLocaleString()} · {e.actor}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Maintenance Status">
          <p>See maintenance workflow for live PM/cleaning status.</p>
          <Link href={`/field/maintenance?printerId=${wo.printerId ?? ""}`} className="text-cyan-400">
            Open maintenance
          </Link>
        </Section>
        <Section title="Troubleshooting Notes">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            placeholder="Add field note…"
          />
          <button
            type="button"
            onClick={() => void saveNote()}
            className="mt-2 min-h-11 rounded-xl bg-slate-800 px-4 text-sm font-semibold"
          >
            Save Note (queues offline)
          </button>
          <p className="mt-2 whitespace-pre-wrap text-slate-400">{wo.notes}</p>
        </Section>
        <Section title="Parts Required / Used">
          {wo.parts.length === 0 ? (
            <p className="text-slate-500">No parts recorded.</p>
          ) : (
            <ul className="space-y-1">
              {wo.parts.map((p) => (
                <li key={p.id}>
                  {p.partNumber} — {p.description} × {p.quantity}
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Labor and Travel">
          <p>Est. hours: {wo.estimatedHours ?? "—"}</p>
          <p>Actual hours: {wo.actualHours ?? "—"}</p>
          <p>Travel time: {wo.travelTime ?? "—"}</p>
        </Section>
        <Section title="Copy Counts">
          <p>Start: {wo.copyCountAtStart ?? "—"}</p>
          <p>End: {wo.copyCountAtEnd ?? "—"}</p>
        </Section>
        <Section title="Photos and Attachments">
          {wo.attachments.length === 0 ? (
            <p className="text-slate-500">None yet.</p>
          ) : (
            <ul>
              {wo.attachments.map((a) => (
                <li key={a.id}>
                  {a.fileName} · {a.kind}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/field/work/${wo.id}/attachments`}
            className="mt-2 inline-block text-cyan-400"
          >
            Capture photos
          </Link>
        </Section>
        <Section title="Customer Signature">
          <label className="block text-xs text-slate-400" htmlFor="sig-name">
            Customer name
          </label>
          <input
            id="sig-name"
            value={sigName}
            onChange={(e) => setSigName(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4"
          />
          <p className="mt-3 text-xs text-slate-500">
            Draw signature on device (touch). Canvas capture stores a local reference for sync.
          </p>
          <SignaturePad
            onCapture={(dataUrl) => {
              void enqueueOperation({
                type: "SIGNATURE",
                userId: TECH_ID,
                technicianName: TECH,
                workOrderId: wo.id,
                payload: {
                  customerName: sigName || "Customer",
                  signatureRef: dataUrl.slice(0, 200),
                  signedAt: new Date().toISOString(),
                },
              }).then(() => {
                setNotice("Signature captured and queued.");
                setTick((t) => t + 1);
              });
            }}
          />
          <label className="mt-3 block text-xs text-slate-400" htmlFor="decline">
            Decline reason
          </label>
          <input
            id="decline"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void saveSignature(false)}
              className="min-h-11 flex-1 rounded-xl bg-cyan-500 text-sm font-semibold text-slate-950"
            >
              Save Signature
            </button>
            <button
              type="button"
              onClick={() => void saveSignature(true)}
              className="min-h-11 flex-1 rounded-xl border border-amber-600 text-sm font-semibold text-amber-200"
            >
              Declined to Sign
            </button>
          </div>
          {wo.customerSignature && (
            <p className="mt-2 text-emerald-300">
              On file: {wo.customerSignature}
            </p>
          )}
        </Section>
        <Section title="Activity Timeline">
          <ul className="space-y-2">
            {timeline.map((e) => (
              <li key={e.id} className="border-l-2 border-slate-700 pl-3">
                <p className="text-white">{e.title}</p>
                <p className="text-xs text-slate-500">
                  {new Date(e.occurredAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Completion Review" defaultOpen>
          {checklist && (
            <ul className="space-y-1 text-sm">
              {checklist.missing.length === 0 ? (
                <li className="text-emerald-300">Ready to complete</li>
              ) : (
                checklist.missing.map((m) => (
                  <li key={m} className="text-amber-200">
                    • {m}
                  </li>
                ))
              )}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setShowComplete(true)}
            className="mt-3 min-h-12 w-full rounded-xl bg-emerald-500/90 text-sm font-semibold text-slate-950"
          >
            Complete Work Order
          </button>
        </Section>
      </div>

      {showComplete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="complete-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <h3 id="complete-title" className="text-lg font-bold">
              Confirm completion
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              {isOfflineLike(status)
                ? "You are offline. This will be marked Completed Offline – Pending Sync until synchronization succeeds."
                : "Submit completion for synchronization."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void completeOffline()}
                className="min-h-12 flex-1 rounded-xl bg-emerald-500 font-semibold text-slate-950"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setShowComplete(false)}
                className="min-h-12 flex-1 rounded-xl border border-slate-600 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </FieldShell>
  );
}

function SignaturePad({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const [drawing, setDrawing] = useState(false);

  return (
    <div className="mt-2">
      <canvas
        id="field-signature-pad"
        width={600}
        height={180}
        className="h-36 w-full touch-none rounded-xl border border-slate-600 bg-white"
        aria-label="Signature pad"
        onPointerDown={(e) => {
          const canvas = e.currentTarget;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          setDrawing(true);
          canvas.setPointerCapture(e.pointerId);
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        }}
        onPointerMove={(e) => {
          if (!drawing) return;
          const ctx = e.currentTarget.getContext("2d");
          if (!ctx) return;
          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          ctx.stroke();
        }}
        onPointerUp={(e) => {
          setDrawing(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="min-h-11 rounded-lg border border-slate-600 px-3 text-xs font-semibold"
          onClick={() => {
            const canvas = document.getElementById(
              "field-signature-pad",
            ) as HTMLCanvasElement | null;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }}
        >
          Clear Signature
        </button>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-cyan-600 px-3 text-xs font-semibold text-cyan-300"
          onClick={() => {
            const canvas = document.getElementById(
              "field-signature-pad",
            ) as HTMLCanvasElement | null;
            if (canvas) onCapture(canvas.toDataURL("image/png"));
          }}
        >
          Capture Pad
        </button>
      </div>
    </div>
  );
}
