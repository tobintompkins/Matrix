"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MatrixCard, MatrixSearchBar } from "../../components/ui";
import PortalShell from "../PortalShell";
import { listPortalPrinters } from "@/lib/portal";

export default function PortalPrintersPage() {
  const [search, setSearch] = useState("");
  const printers = useMemo(() => listPortalPrinters({ search }), [search]);

  return (
    <PortalShell title="Printers">
      <div className="mb-4">
        <MatrixSearchBar
          value={search}
          onValueChange={setSearch}
          placeholder="Search name or serial…"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {printers.map((p) => (
          <MatrixCard key={p.id} title={p.name} subtitle={`${p.model} · ${p.serialNumber}`}>
            <p className="text-sm text-slate-300">{p.locationName}</p>
            <p className="text-xs text-slate-500">
              Status {p.status}
              {p.meter != null ? ` · Meter ${p.meter.toLocaleString()}` : ""}
              {p.nextPmEstimate ? ` · PM ${p.nextPmEstimate}` : ""}
            </p>
            <p className="text-xs text-slate-500">Open tickets: {p.openTicketCount}</p>
            <Link
              href={`/portal/printers/${p.id}`}
              className="mt-3 inline-block text-sm text-cyan-300"
            >
              View details →
            </Link>
          </MatrixCard>
        ))}
      </div>
    </PortalShell>
  );
}
