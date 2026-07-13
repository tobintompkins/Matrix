"use client";

import { useEffect, useState } from "react";
import WorkflowPanel from "@/app/components/WorkflowPanel";
import {
  MatrixButton,
  MatrixCard,
  MatrixEmptyState,
  MatrixStatCard,
  MatrixStatusBadge,
  ticketStatusBadgeClassName,
  ticketStatusToVariant,
} from "@/app/components/ui";
import { getWorkflowActions } from "@/lib/workflow/registry";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";
import {
  attachmentPlaceholders,
  ticketWorkspaces,
} from "@/lib/tickets/workspace-data";
import type { TicketWorkspace as TicketData } from "@/lib/tickets/workspace-types";

const priorityStyles: Record<string, string> = {
  High: "text-rose-300",
  Medium: "text-amber-300",
  Low: "text-slate-400",
};

export default function TicketWorkspace() {
  const workflowContext = useWorkflowContext();
  const [selectedTicketNumber, setSelectedTicketNumber] = useState(
    workflowContext.ticket ?? ticketWorkspaces[0].ticketNumber,
  );
  const [technicianNotes, setTechnicianNotes] = useState("");
  const [jobStatus, setJobStatus] = useState<string>(
    ticketWorkspaces[0].status,
  );
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);

  const ticket: TicketData =
    ticketWorkspaces.find((t) => t.ticketNumber === selectedTicketNumber) ??
    ticketWorkspaces[0];

  const workflowActions = getWorkflowActions("service-ticket", {
    ticket: ticket.ticketNumber,
    printer: ticket.printerSlug,
    assetId: ticket.assetId,
    model: ticket.printerModel,
    customer: ticket.customer,
  });

  useEffect(() => {
    if (!workflowContext.ticket) return;
    const match = ticketWorkspaces.find(
      (t) => t.ticketNumber === workflowContext.ticket,
    );
    if (match) {
      setSelectedTicketNumber(match.ticketNumber);
      setJobStatus(match.status);
    }
  }, [workflowContext.ticket]);

  function handleTicketChange(ticketNumber: string) {
    const next = ticketWorkspaces.find((t) => t.ticketNumber === ticketNumber);
    if (next) {
      setSelectedTicketNumber(ticketNumber);
      setJobStatus(next.status);
      setTechnicianNotes("");
      setAiMessages([]);
      setAiInput("");
    }
  }

  function handleAiSend() {
    if (!aiInput.trim()) return;
    setAiMessages((current) => [
      ...current,
      { role: "user", text: aiInput.trim() },
      {
        role: "assistant",
        text: "AI assistant is not connected yet. Analysis and recommendations will appear here in a future release.",
      },
    ]);
    setAiInput("");
  }

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm text-slate-400">Active Ticket</label>
          <select
            value={selectedTicketNumber}
            onChange={(e) => handleTicketChange(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {ticketWorkspaces.map((t) => (
              <option key={t.ticketNumber} value={t.ticketNumber}>
                {t.ticketNumber} — {t.assetId}
              </option>
            ))}
          </select>
        </div>

        <MatrixCard title="Ticket Header">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Ticket Number</p>
              <p className="mt-1 font-semibold text-cyan-400">
                {ticket.ticketNumber}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Customer</p>
              <p className="mt-1 font-medium text-white">{ticket.customer}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Printer Model</p>
              <p className="mt-1 font-medium text-white">{ticket.printerModel}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Asset ID</p>
              <p className="mt-1 font-medium text-white">{ticket.assetId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Serial Number</p>
              <p className="mt-1 font-medium text-white">{ticket.serialNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <div className="mt-1">
                <MatrixStatusBadge
                  variant={ticketStatusToVariant(jobStatus)}
                  label={jobStatus}
                  className={ticketStatusBadgeClassName(jobStatus)}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Priority</p>
              <p
                className={`mt-1 font-semibold ${priorityStyles[ticket.priority]}`}
              >
                {ticket.priority}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Assigned Technician</p>
              <p className="mt-1 font-medium text-white">
                {ticket.assignedTechnician}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Date Opened</p>
              <p className="mt-1 font-medium text-white">{ticket.dateOpened}</p>
            </div>
          </div>
        </MatrixCard>

        <MatrixCard title="Problem Description">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-4 text-sm leading-relaxed text-slate-300">
            {ticket.problemDescription}
          </div>
        </MatrixCard>

        <MatrixCard title="Technician Notes">
          <textarea
            rows={6}
            value={technicianNotes}
            onChange={(e) => setTechnicianNotes(e.target.value)}
            placeholder="Technician findings..."
            className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </MatrixCard>

        <MatrixCard title="Job Actions">
          <div className="flex flex-wrap gap-3">
            <MatrixButton
              type="button"
              variant="primary"
              size="md"
              onClick={() => setJobStatus("In Progress")}
            >
              Start Job
            </MatrixButton>
            <MatrixButton
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setJobStatus("Paused")}
            >
              Pause Job
            </MatrixButton>
            <MatrixButton
              type="button"
              variant="success"
              size="md"
              onClick={() => setJobStatus("Completed")}
            >
              Complete Job
            </MatrixButton>
          </div>
        </MatrixCard>

        <WorkflowPanel
          title="Workflow"
          description="Follow the service chain: Customer → Printer → Ticket → PM → Inventory → Order Parts → Knowledge Base → AI."
          actions={workflowActions}
        />

        <MatrixCard title="Attachments">
          <div className="grid gap-4 sm:grid-cols-2">
            {attachmentPlaceholders.map((attachment) => (
              <MatrixEmptyState
                key={attachment.id}
                title={attachment.label}
                description={`${attachment.description} — No files attached.`}
                className="py-8"
              />
            ))}
          </div>
        </MatrixCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <MatrixCard title="Time Tracking">
            <div className="grid gap-4 sm:grid-cols-3">
              <MatrixStatCard
                label="Travel Time"
                value={ticket.travelTime}
                className="p-4 text-center [&_p]:text-center"
              />
              <MatrixStatCard
                label="Repair Time"
                value={ticket.repairTime}
                className="p-4 text-center [&_p]:text-center"
              />
              <MatrixStatCard
                label="Total Time"
                value={ticket.totalTime}
                accent="text-cyan-400"
                className="p-4 text-center [&_p]:text-center"
              />
            </div>
          </MatrixCard>

          <MatrixCard title="Customer Signature">
            <MatrixEmptyState
              title="Signature capture area"
              description="Customer sign-off on job completion"
              className="h-40 py-8"
            />
          </MatrixCard>
        </div>
      </div>

      <aside className="w-full shrink-0 xl:w-80">
        <MatrixCard
          title="Matrix AI Technician"
          subtitle="What problem are you seeing today?"
          className="sticky top-8"
          bodyClassName="p-4"
        >
          <div className="flex h-80 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              {aiMessages.length === 0 ? (
                <MatrixEmptyState
                  title="No messages yet"
                  description="AI responses will appear here. Not connected yet."
                  className="border-none bg-transparent py-8"
                />
              ) : (
                aiMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "ml-4 bg-cyan-500/10 text-cyan-100"
                        : "mr-4 bg-slate-800 text-slate-300"
                    }`}
                  >
                    {msg.text}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAiSend()}
                placeholder="Ask about this ticket..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
              />
              <MatrixButton
                type="button"
                variant="primary"
                size="md"
                onClick={handleAiSend}
              >
                Send
              </MatrixButton>
            </div>
          </div>
        </MatrixCard>
      </aside>
    </div>
  );
}
