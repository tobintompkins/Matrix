"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { MatrixCard, MatrixEmptyState } from "../../../components/ui";
import PortalShell from "../../PortalShell";
import { getPortalPrinter, listPortalTickets } from "@/lib/portal";

export default function PortalPrinterDetailPage({
  params,
}: {
  params: Promise<{ printerId: string }>;
}) {
  const { printerId } = use(params);
  const result = useMemo(() => getPortalPrinter(printerId), [printerId]);
  const tickets = useMemo(
    () =>
      result.ok
        ? listPortalTickets().filter((t) =>
            t.printerLabel.includes(result.printer.serialNumber),
          )
        : [],
    [result],
  );

  if (!result.ok) {
    return (
      <PortalShell title="Printer">
        <MatrixEmptyState title="Access denied" description={result.error} />
      </PortalShell>
    );
  }

  const p = result.printer;

  return (
    <PortalShell title={p.name}>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <MatrixCard title="Overview">
          <dl className="space-y-2 text-sm text-slate-300">
            <div>
              <dt className="text-xs text-slate-500">Model / Serial</dt>
              <dd>
                {p.model} · {p.serialNumber}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Location</dt>
              <dd>{p.locationName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd>{p.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Meter</dt>
              <dd>{p.meter?.toLocaleString() ?? "Hidden"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Coverage</dt>
              <dd>{p.coverageStatus}</dd>
            </div>
          </dl>
        </MatrixCard>
        <MatrixCard title="Service tickets">
          <ul className="space-y-2 text-sm">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/portal/tickets/${t.id}`} className="text-cyan-300">
                  {t.ticketNumber}
                </Link>{" "}
                — {t.customerStatus}
              </li>
            ))}
            {tickets.length === 0 ? (
              <li className="text-slate-400">No tickets for this printer.</li>
            ) : null}
          </ul>
        </MatrixCard>
      </div>
    </PortalShell>
  );
}
