"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MatrixButton, MatrixCard, MatrixSearchBar } from "../../components/ui";
import PortalShell from "../PortalShell";
import { listPortalLocations } from "@/lib/portal";

export default function PortalLocationsPage() {
  const [q, setQ] = useState("");
  const locations = useMemo(() => {
    const all = listPortalLocations();
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter(
      (l) => l.name.toLowerCase().includes(s) || l.address.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <PortalShell title="Locations">
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="min-w-[240px] flex-1">
          <MatrixSearchBar value={q} onValueChange={setQ} placeholder="Search locations…" />
        </div>
        <MatrixButton href="/portal/tickets/new" variant="primary" size="md">
          New ticket
        </MatrixButton>
      </div>
      <ul className="space-y-3">
        {locations.map((l) => (
          <li key={l.id}>
            <MatrixCard title={l.name} subtitle={l.address}>
              <p className="text-sm text-slate-300">
                {l.printerCount} printers · {l.openTicketCount} open tickets ·{" "}
                {l.upcomingPmCount} upcoming PMs
              </p>
              <Link
                href={`/portal/locations/${l.id}`}
                className="mt-2 inline-block text-sm text-cyan-300"
              >
                Open location →
              </Link>
            </MatrixCard>
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}
