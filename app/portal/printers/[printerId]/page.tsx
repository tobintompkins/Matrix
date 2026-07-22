"use client";

import Link from "next/link";
import { use, useMemo } from "react";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../../../components/ui";
import PortalShell from "../../PortalShell";
import { getMachinePortalProfile } from "@/lib/portal/machine-profile";

export default function PortalPrinterDetailPage({
  params,
}: {
  params: Promise<{ printerId: string }>;
}) {
  const { printerId } = use(params);
  const result = useMemo(() => getMachinePortalProfile(printerId), [printerId]);

  if (!result.ok) {
    return (
      <PortalShell title="Printer">
        <MatrixEmptyState title="Access denied" description={result.error} />
      </PortalShell>
    );
  }

  const { machine: p, openServiceRequests, serviceHistory, documents, actions } =
    result;

  return (
    <PortalShell title={p.name}>
      <div className="mb-4 flex flex-wrap gap-2">
        <MatrixButton href={actions.requestServiceHref} variant="primary" size="md">
          Request Service
        </MatrixButton>
        <MatrixButton href={actions.requestPartsHref} variant="secondary" size="md">
          Request Parts
        </MatrixButton>
        <MatrixButton href={actions.partsBuilderHref} variant="secondary" size="md">
          Guided parts entry
        </MatrixButton>
      </div>

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
              <dt className="text-xs text-slate-500">Site</dt>
              <dd>{p.locationName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Operational status</dt>
              <dd>{p.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Last service</dt>
              <dd>{p.lastServiceDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Last PM / meter snapshot</dt>
              <dd>{p.lastPmDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Next PM due</dt>
              <dd>
                {p.nextPmDue ?? "—"}
                {p.pmStatus ? ` · ${p.pmStatus}` : ""}
                {p.nextPmMeter != null
                  ? ` · meter ${p.nextPmMeter.toLocaleString()}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Current meter</dt>
              <dd>
                {p.currentMeter != null ? p.currentMeter.toLocaleString() : "—"}
              </dd>
            </div>
          </dl>
        </MatrixCard>

        <MatrixCard title="Open service requests">
          <ul className="space-y-2 text-sm">
            {openServiceRequests.map((t) => (
              <li key={t.id}>
                <Link href={`/portal/tickets/${t.id}`} className="text-cyan-300">
                  {t.ticketNumber}
                </Link>{" "}
                — {t.status}
              </li>
            ))}
            {openServiceRequests.length === 0 ? (
              <li className="text-slate-400">No open requests for this machine.</li>
            ) : null}
          </ul>
        </MatrixCard>

        <MatrixCard title="Service history">
          <ul className="space-y-2 text-sm">
            {serviceHistory.map((t) => (
              <li key={t.id}>
                <Link href={`/portal/tickets/${t.id}`} className="text-cyan-300">
                  {t.ticketNumber}
                </Link>{" "}
                — {t.status}
              </li>
            ))}
            {serviceHistory.length === 0 ? (
              <li className="text-slate-400">No closed history yet.</li>
            ) : null}
          </ul>
        </MatrixCard>

        <MatrixCard title="Manuals & documents">
          <ul className="space-y-2 text-sm">
            {documents.map((d) => (
              <li key={d.id}>
                <Link href="/portal/documents" className="text-cyan-300">
                  {d.title}
                </Link>
                <span className="text-slate-500"> · {d.category}</span>
              </li>
            ))}
            {documents.length === 0 ? (
              <li className="text-slate-400">No customer documents published.</li>
            ) : null}
          </ul>
        </MatrixCard>
      </div>
    </PortalShell>
  );
}
