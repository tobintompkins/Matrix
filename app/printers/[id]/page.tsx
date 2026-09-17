import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import MatrixShell from "@/app/components/MatrixShell";
import WorkflowChain from "@/app/components/WorkflowChain";
import WorkflowPanel from "@/app/components/WorkflowPanel";
import MachineMaintenancePanel from "@/app/components/maintenance/MachineMaintenancePanel";
import { getPrinter } from "@/lib/printers/get-printer";
import type { PrinterComponent } from "@/lib/printers/types";
import { getWorkflowActions } from "@/lib/workflow/registry";
import { buildWorkflowUrl, withFrom } from "@/lib/workflow/routes";

export const dynamic='force-dynamic';

type PrinterPageProps = {
  params: Promise<{ id: string }>;
};

const statusStyles: Record<string, string> = {
  Online: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  "PM Due": "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  Attention: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
  "In Service": "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
  Open: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
  "In Progress": "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
};

const componentStatusStyles: Record<PrinterComponent["status"], string> = {
  Good: "bg-emerald-500/15 text-emerald-300",
  Monitor: "bg-amber-500/15 text-amber-300",
  "Replace Soon": "bg-orange-500/15 text-orange-300",
  Critical: "bg-rose-500/15 text-rose-300",
};

const priorityStyles: Record<string, string> = {
  High: "text-rose-300",
  Medium: "text-amber-300",
  Low: "text-slate-400",
};

function formatNumber(value: number): string {
  return Number.isFinite(value)?value.toLocaleString("en-US"):"Not recorded";
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-800 py-3 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-white">{value}</span>
    </div>
  );
}

export default async function PrinterPage({ params }: PrinterPageProps) {
  const { id } = await params;
  const printer = await getPrinter(id);

  if (!printer) {
    notFound();
  }

  const workflowActions = getWorkflowActions("digital-twin", {
    printer: printer.id,
    assetId: printer.assetNumber,
    model: printer.model,
    customer: printer.customer,
    ticket: printer.openTickets[0]?.ticketNumber,
  });

  const workflowContext = {
    printer: printer.id,
    assetId: printer.assetNumber,
    model: printer.model,
    customer: printer.customer,
    ticket: printer.openTickets[0]?.ticketNumber,
  };

  return (
    <MatrixShell
      title={`Digital Twin — ${printer.assetNumber}`}
      activePath="/fleet"
    >
      <div className="mb-6">
        <Link
          href="/fleet"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to Fleet
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            statusStyles[printer.status] ?? statusStyles.Online
          }`}
        >
          {printer.status}
        </span>
        <span className="text-sm text-slate-400">
          {printer.model} · {printer.location}
        </span>
      </div>

      <WorkflowChain
        current="digital-twin"
        context={workflowContext}
        className="mb-6"
      />

      <WorkflowPanel
        title="Workflow"
        description="Launch PM, tickets, inventory, and parts workflows from this digital twin."
        actions={workflowActions}
        className="mb-6"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard title="Printer Information">
          <InfoRow label="Model" value={printer.model} />
          <InfoRow label="Serial Number" value={printer.serialNumber} />
          <InfoRow label="Asset Number" value={printer.assetNumber} />
          <InfoRow label="Customer" value={printer.customer} />
          <InfoRow label="Location" value={printer.location} />
          <InfoRow
            label="Status"
            value={
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  statusStyles[printer.status] ?? statusStyles.Online
                }`}
              >
                {printer.status}
              </span>
            }
          />
        </InfoCard>

        <InfoCard title="Meter Information">
          <InfoRow
            label="Total Impressions"
            value={formatNumber(printer.meters.totalImpressions)}
          />
          <InfoRow label="Color" value={formatNumber(printer.meters.color)} />
          <InfoRow label="Black" value={formatNumber(printer.meters.black)} />
          <InfoRow label="Last Meter Read" value={printer.meters.lastMeterRead} />
        </InfoCard>

        <InfoCard title="PM Information">
          <InfoRow label="Last PM" value={printer.pm.lastPM} />
          <InfoRow label="Next PM Due" value={printer.pm.nextPMDue} />
          <InfoRow label="PM Kit Installed" value={printer.pm.pmKitInstalled} />
        </InfoCard>

        <InfoCard title="Matrix AI Technician">
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center">
            <p className="text-sm font-medium text-cyan-400">
              Matrix AI Technician
            </p>
            <p className="mt-3 text-slate-400">No analysis available yet.</p>
          </div>
        </InfoCard>
      </div>

      <div className="mt-6">
        <MachineMaintenancePanel printerId={printer.assetNumber} />
      </div>

      <div className="mt-6">
        <InfoCard title="Installed Components">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Component</th>
                  <th className="pb-3 font-medium">Part #</th>
                  <th className="pb-3 font-medium">Life Used</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Installed</th>
                </tr>
              </thead>
              <tbody>
                {printer.components.map((component) => (
                  <tr
                    key={component.partNumber}
                    className="border-t border-slate-800 text-slate-200"
                  >
                    <td className="py-3 font-medium text-white">
                      {component.name}
                    </td>
                    <td className="py-3 text-cyan-400">{component.partNumber}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className={`h-full rounded-full ${
                              component.lifeUsedPercent >= 80
                                ? "bg-rose-500"
                                : component.lifeUsedPercent >= 60
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{ width: `${component.lifeUsedPercent}%` }}
                          />
                        </div>
                        <span className="text-slate-400">
                          {component.lifeUsedPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          componentStatusStyles[component.status]
                        }`}
                      >
                        {component.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">
                      {component.installedDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </InfoCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-bold text-white">Service History</h3>
          <p className="mt-2 text-sm text-slate-400">
            Timeline of previous repairs and maintenance.
          </p>

          <ol className="mt-6 space-y-0">
            {printer.serviceHistory.map((entry, index) => (
              <li key={entry.id} className="relative flex gap-4 pb-8 last:pb-0">
                {index < printer.serviceHistory.length - 1 && (
                  <span className="absolute left-[7px] top-4 h-full w-px bg-slate-700" />
                )}
                <span className="relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-cyan-400 bg-slate-900" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-cyan-400">
                      {entry.date}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                      {entry.type}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{entry.summary}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.technician}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-bold text-white">Open Tickets</h3>
          <p className="mt-2 text-sm text-slate-400">
            Current service tickets for this printer.
          </p>

          {printer.openTickets.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No open tickets.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {printer.openTickets.map((ticket) => (
                <div
                  key={ticket.ticketNumber}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-cyan-400">
                      {ticket.ticketNumber}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        statusStyles[ticket.status] ?? statusStyles.Open
                      }`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-200">{ticket.issue}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                    <span
                      className={`font-semibold ${priorityStyles[ticket.priority]}`}
                    >
                      {ticket.priority} Priority
                    </span>
                    <span>Assigned: {ticket.assignedTo}</span>
                    <span>Created: {ticket.created}</span>
                  </div>
                  <Link
                    href={buildWorkflowUrl(
                      "/tickets",
                      withFrom(
                        {
                          ticket: ticket.ticketNumber,
                          printer: printer.id,
                          assetId: printer.assetNumber,
                          model: printer.model,
                        },
                        "digital-twin",
                      ),
                    )}
                    className="mt-3 inline-block text-xs font-medium text-cyan-400 hover:text-cyan-300"
                  >
                    Open in Service Ticket →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </MatrixShell>
  );
}
