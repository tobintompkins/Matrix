"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatusBadge,
} from "../components/ui";
import { listServiceCalls, type ServiceCall } from "@/lib/service-calls";
import {
  acceptAssignment,
  addLabor,
  completeTicketWithSignature,
  declineAssignment,
  getDiagnostic,
  getMxTicketNumber,
  getOfflineDraft,
  getPmOpportunity,
  saveDiagnostic,
  saveOfflineDraft,
  transitionDispatchTicket,
  type DispatchTicketStatus,
} from "@/lib/service-dispatch";
import { notifyTicketEvent } from "@/lib/notifications";

const ACTIONS: Array<{ label: string; status: DispatchTicketStatus }> = [
  { label: "Start Travel", status: "TRAVELING" },
  { label: "Arrive On Site", status: "ON_SITE" },
  { label: "Start Diagnosis", status: "DIAGNOSIS" },
  { label: "Start Repair", status: "REPAIR_IN_PROGRESS" },
  { label: "Begin Testing", status: "TESTING" },
  { label: "Customer Review", status: "CUSTOMER_REVIEW" },
];

export default function TechnicianMobileWorkflow({
  technicianName = "Toby Tompkins",
}: {
  technicianName?: string;
}) {
  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [signature, setSignature] = useState("");
  const [meter, setMeter] = useState("");
  const [notice, setNotice] = useState("");

  const mine = useMemo(() => {
    void tick;
    return listServiceCalls().filter(
      (c) =>
        c.assignment.technician === technicianName &&
        !["CLOSED", "CANCELLED"].includes(c.status),
    );
  }, [tick, technicianName]);

  const selected: ServiceCall | undefined = useMemo(() => {
    void tick;
    return mine.find((c) => c.id === selectedId) ?? mine[0];
  }, [mine, selectedId, tick]);

  function refresh() {
    setTick((t) => t + 1);
  }

  if (!selected) {
    return (
      <MatrixEmptyState
        title="No assigned tickets"
        description="Accept a dispatch assignment to begin the mobile workflow."
      />
    );
  }

  const mx = getMxTicketNumber(selected.id);
  const draft = getOfflineDraft(selected.id);
  const pm = getPmOpportunity(selected.machine.currentMeterCount, selected.machine.currentMeterCount + 40_000);
  const diag = getDiagnostic(selected.id);

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-24">
      {notice ? (
        <p className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100">
          {notice}
        </p>
      ) : null}

      <MatrixCard title={mx} subtitle={selected.problem.issueTitle}>
        <div className="space-y-2 text-sm">
          <MatrixStatusBadge
            label={selected.status.replaceAll("_", " ")}
            variant="active"
          />
          <p className="text-white">
            {selected.machine.customerName} · {selected.machine.siteName}
          </p>
          <p className="text-slate-400">{selected.machine.machineLocation}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              className="rounded-lg bg-slate-800 px-3 py-2 text-cyan-300"
              href={`tel:${selected.contact.reporterPhone || ""}`}
            >
              Tap to call
            </a>
            <a
              className="rounded-lg bg-slate-800 px-3 py-2 text-cyan-300"
              href={`https://maps.google.com/?q=${encodeURIComponent(selected.machine.machineLocation)}`}
              target="_blank"
              rel="noreferrer"
            >
              Navigate
            </a>
            <Link
              href={`/printers/${selected.machine.machineId}`}
              className="rounded-lg bg-slate-800 px-3 py-2 text-cyan-300"
            >
              Printer history
            </Link>
            <Link
              href="/guided-diagram-ordering"
              className="rounded-lg bg-slate-800 px-3 py-2 text-cyan-300"
            >
              Diagrams / parts
            </Link>
          </div>
          {pm ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-100">
              {pm.message}
            </p>
          ) : null}
        </div>
      </MatrixCard>

      <div className="grid grid-cols-2 gap-2">
        <MatrixButton
          type="button"
          variant="success"
          size="lg"
          onClick={() => {
            const r = acceptAssignment(selected.id, technicianName);
            setNotice(r.ok ? "Assignment accepted" : r.error ?? "Failed");
            if (r.ok) {
              notifyTicketEvent({
                type: "TICKET_ACCEPTED",
                title: `${mx} accepted`,
                message: `${technicianName} accepted the assignment`,
                ticketId: selected.id,
                ticketNumber: mx,
              });
            }
            refresh();
          }}
        >
          Accept
        </MatrixButton>
        <MatrixButton
          type="button"
          variant="danger"
          size="lg"
          onClick={() => {
            const r = declineAssignment(selected.id, technicianName, "Schedule conflict");
            setNotice(r.ok ? "Assignment declined" : r.error ?? "Failed");
            refresh();
          }}
        >
          Decline
        </MatrixButton>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {ACTIONS.map((a) => (
          <MatrixButton
            key={a.status}
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => {
              const r = transitionDispatchTicket(selected.id, a.status, technicianName);
              setNotice(r.ok ? a.label : r.error ?? "Blocked");
              if (r.ok && a.status === "TRAVELING") {
                addLabor({
                  ticketId: selected.id,
                  technicianId: technicianName,
                  startTime: new Date().toISOString(),
                  endTime: null,
                  laborMinutes: 0,
                  laborType: "TRAVEL",
                  notes: "Travel started",
                  billable: true,
                });
                notifyTicketEvent({
                  type: "TECHNICIAN_TRAVELING",
                  title: `${mx} — traveling`,
                  message: `${technicianName} started travel`,
                  ticketId: selected.id,
                  ticketNumber: mx,
                });
              }
              refresh();
            }}
          >
            {a.label}
          </MatrixButton>
        ))}
      </div>

      <MatrixCard title="Diagnostic notes" subtitle="Saved offline-safe as draft.">
        <textarea
          value={note || diag.confirmedSymptom}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
          placeholder="Confirmed symptom / error codes…"
        />
        <div className="mt-2 flex gap-2">
          <MatrixButton
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              saveOfflineDraft({
                ticketId: selected.id,
                notes: note,
                savedAt: new Date().toISOString(),
                pendingStatus: null,
              });
              setNotice("Draft saved locally");
            }}
          >
            Save draft
          </MatrixButton>
          <MatrixButton
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              saveDiagnostic(
                selected.id,
                { ...diag, confirmedSymptom: note || diag.confirmedSymptom },
                technicianName,
              );
              setNotice("Diagnosis saved");
              refresh();
            }}
          >
            Save diagnosis
          </MatrixButton>
        </div>
        {draft ? (
          <p className="mt-2 text-xs text-slate-500">
            Local draft from {draft.savedAt.slice(0, 19)}
          </p>
        ) : null}
      </MatrixCard>

      <MatrixCard title="Complete ticket" subtitle="Signature + meter required.">
        <input
          value={meter}
          onChange={(e) => setMeter(e.target.value)}
          placeholder="Final meter count"
          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
        />
        <input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="Customer signature / typed acknowledgment"
          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white"
        />
        <MatrixButton
          type="button"
          variant="success"
          size="lg"
          className="w-full"
          onClick={() => {
            const r = completeTicketWithSignature({
              ticketId: selected.id,
              meterAtClose: Number(meter) || selected.machine.currentMeterCount,
              resolutionSummary: note || selected.resolution.resolutionSummary || "Repaired on site",
              workPerformed: note || selected.resolution.workPerformed || "Service completed",
              testResults: "Test prints OK",
              finalCondition: "OPERATIONAL",
              technicianName,
              customerContactName: selected.contact.customerContactName || selected.contact.reportedBy,
              customerSignature: signature,
              actor: technicianName,
            });
            setNotice(r.ok ? "Ticket completed — report generated" : r.error ?? "Failed");
            refresh();
          }}
        >
          Complete Ticket
        </MatrixButton>
      </MatrixCard>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {mine.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs ${
              c.id === selected.id
                ? "bg-cyan-500/20 text-cyan-200"
                : "bg-slate-800 text-slate-400"
            }`}
          >
            {getMxTicketNumber(c.id)}
          </button>
        ))}
      </div>
    </div>
  );
}
