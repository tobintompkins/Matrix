"use client";

import { useEffect, useMemo, useState } from "react";
import WorkflowPanel from "@/app/components/WorkflowPanel";
import { getWorkflowActions } from "@/lib/workflow/registry";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";
import {
  contextPrinters,
  createSuggestedChecks,
  issueCategories,
  relatedInventory,
  relatedPartsReplaced,
  relatedPmHistory,
  relatedServiceHistory,
  relatedTickets,
} from "@/lib/ai-technician/data";
import type {
  IssueCategory,
  RelatedItem,
  SuggestedCheck,
} from "@/lib/ai-technician/types";

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-4">
        <h3 className="text-lg font-bold">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        )}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function RelatedList({ items }: { items: RelatedItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3"
        >
          <p className="text-sm font-medium text-cyan-400">{item.title}</p>
          <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
        </li>
      ))}
    </ul>
  );
}

const ticketAssetMap: Record<string, string> = {
  "TKT-2026-0142": "MX-GD-002",
  "TKT-2026-0138": "MX-VA-002",
  "TKT-2026-0135": "MX-GL-001",
};

export default function AITechnicianPanel() {
  const workflowContext = useWorkflowContext();
  const [selectedAssetId, setSelectedAssetId] = useState(
    workflowContext.assetId ??
      (workflowContext.ticket
        ? ticketAssetMap[workflowContext.ticket]
        : undefined) ??
      contextPrinters[0].assetId,
  );
  const [issueCategory, setIssueCategory] =
    useState<IssueCategory>("Paper Jam");
  const [checks, setChecks] = useState<SuggestedCheck[]>(createSuggestedChecks);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);

  const printer =
    contextPrinters.find((p) => p.assetId === selectedAssetId) ??
    contextPrinters[0];

  const workflowActions = useMemo(
    () =>
      getWorkflowActions("ai-technician", {
        ticket: workflowContext.ticket,
        assetId: printer.assetId,
        printer: printer.assetId.toLowerCase(),
        model: printer.model,
        customer: printer.customer,
      }),
    [printer, workflowContext.ticket],
  );

  useEffect(() => {
    if (workflowContext.assetId) {
      const match = contextPrinters.find(
        (p) => p.assetId === workflowContext.assetId,
      );
      if (match) setSelectedAssetId(match.assetId);
      return;
    }
    if (workflowContext.ticket && ticketAssetMap[workflowContext.ticket]) {
      setSelectedAssetId(ticketAssetMap[workflowContext.ticket]);
    }
  }, [workflowContext.assetId, workflowContext.ticket]);

  function toggleCheck(id: string) {
    setChecks((current) =>
      current.map((check) =>
        check.id === id ? { ...check, completed: !check.completed } : check,
      ),
    );
  }

  function handleSend() {
    if (!chatInput.trim()) return;

    setMessages((current) => [
      ...current,
      { role: "user", text: chatInput.trim() },
      {
        role: "assistant",
        text: `Placeholder response for ${printer.model} (${printer.assetId}) / ${issueCategory}. Real AI troubleshooting will be connected in a future release.`,
      },
    ]);
    setChatInput("");
  }

  return (
    <div className="space-y-8">
      <WorkflowPanel
        title="Workflow"
        description="Jump to tickets, digital twin, knowledge base, and parts ordering."
        actions={workflowActions}
      />

      <SectionCard
        title="Matrix AI Technician"
        description="Ask a service question and Matrix will help narrow down the issue."
      >
        <div className="flex h-80 flex-col rounded-lg border border-slate-800 bg-slate-950/60">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="max-w-md text-center text-sm text-slate-500">
                  Start a troubleshooting conversation. Responses are
                  placeholders only — no AI backend is connected yet.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`rounded-lg px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "ml-8 bg-cyan-500/10 text-cyan-100"
                      : "mr-8 bg-slate-800 text-slate-300"
                  }`}
                >
                  {message.text}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-800 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Example: GD9630 is jamming from Tray 2 and leaving black marks on the edge..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={handleSend}
                className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Diagnostic Context"
          description="Provide printer and issue details to focus troubleshooting."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Customer
              </label>
              <input
                type="text"
                readOnly
                value={printer.customer}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Asset ID
              </label>
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {contextPrinters.map((option) => (
                  <option key={option.assetId} value={option.assetId}>
                    {option.assetId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Printer Model
              </label>
              <input
                type="text"
                readOnly
                value={printer.model}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Serial Number
              </label>
              <input
                type="text"
                readOnly
                value={printer.serialNumber}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Meter Count
              </label>
              <input
                type="text"
                readOnly
                value={formatNumber(printer.meterCount)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Error Code
              </label>
              <input
                type="text"
                readOnly
                value={printer.errorCode}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-amber-300"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-400">
                Issue Category
              </label>
              <select
                value={issueCategory}
                onChange={(e) =>
                  setIssueCategory(e.target.value as IssueCategory)
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {issueCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Suggested Checks"
          description="Work through common diagnostic steps for this issue type."
        >
          <ul className="space-y-3">
            {checks.map((check) => (
              <li key={check.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 transition hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={check.completed}
                    onChange={() => toggleCheck(check.id)}
                    className="h-4 w-4 rounded accent-cyan-500"
                  />
                  <span
                    className={
                      check.completed
                        ? "text-slate-400 line-through"
                        : "text-slate-200"
                    }
                  >
                    {check.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="Related Data"
        description="Linked tickets, service records, parts, PM, and inventory context."
      >
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-300">
              Recent Tickets
            </h4>
            <RelatedList items={relatedTickets} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-300">
              Service History
            </h4>
            <RelatedList items={relatedServiceHistory} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-300">
              Parts Replaced
            </h4>
            <RelatedList items={relatedPartsReplaced} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-300">
              PM History
            </h4>
            <RelatedList items={relatedPmHistory} />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-300">
              Inventory Availability
            </h4>
            <RelatedList items={relatedInventory} />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
