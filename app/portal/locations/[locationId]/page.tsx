"use client";

import { use, useMemo } from "react";
import { MatrixCard, MatrixEmptyState } from "../../../components/ui";
import PortalShell from "../../PortalShell";
import { getPortalLocation, listPortalPrinters, listPortalTickets } from "@/lib/portal";

export default function PortalLocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = use(params);
  const result = useMemo(() => getPortalLocation(locationId), [locationId]);
  const printers = useMemo(
    () => (result.ok ? listPortalPrinters({ locationId }) : []),
    [result, locationId],
  );
  const tickets = useMemo(
    () =>
      result.ok
        ? listPortalTickets({ statusGroup: "OPEN" }).filter(
            (t) => t.locationName === result.location.name,
          )
        : [],
    [result],
  );

  if (!result.ok) {
    return (
      <PortalShell title="Location">
        <MatrixEmptyState title="Access denied" description={result.error} />
      </PortalShell>
    );
  }

  return (
    <PortalShell title={result.location.name}>
      <p className="mb-6 text-slate-300">{result.location.address}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <MatrixCard title="Printers">
          <ul className="space-y-2 text-sm text-slate-300">
            {printers.map((p) => (
              <li key={p.id}>
                {p.name} · {p.model}
              </li>
            ))}
          </ul>
        </MatrixCard>
        <MatrixCard title="Open tickets">
          <ul className="space-y-2 text-sm text-slate-300">
            {tickets.map((t) => (
              <li key={t.id}>
                {t.ticketNumber} — {t.problemTitle}
              </li>
            ))}
          </ul>
        </MatrixCard>
      </div>
    </PortalShell>
  );
}
