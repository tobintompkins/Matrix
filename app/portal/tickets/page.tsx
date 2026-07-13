"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MatrixButton, MatrixCard, MatrixSearchBar } from "../../components/ui";
import PortalShell from "../PortalShell";
import { listPortalTickets } from "@/lib/portal";

export default function PortalTicketsPage() {
  const [group, setGroup] = useState("OPEN");
  const [search, setSearch] = useState("");
  const tickets = useMemo(
    () => listPortalTickets({ statusGroup: group, search }),
    [group, search],
  );

  return (
    <PortalShell title="Service tickets">
      <div className="mb-4 flex flex-wrap gap-2">
        {["ALL", "OPEN", "SCHEDULED", "WAITING_FOR_PARTS", "RESOLVED"].map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              group === g ? "bg-cyan-500/20 text-cyan-200" : "bg-slate-800 text-slate-400"
            }`}
          >
            {g.replaceAll("_", " ")}
          </button>
        ))}
        <MatrixButton href="/portal/tickets/new" variant="primary" size="sm">
          New ticket
        </MatrixButton>
      </div>
      <MatrixSearchBar
        value={search}
        onValueChange={setSearch}
        placeholder="Search ticket #, serial, issue…"
      />
      <ul className="mt-4 space-y-3">
        {tickets.map((t) => (
          <li key={t.id}>
            <MatrixCard
              title={t.ticketNumber}
              subtitle={`${t.printerLabel} · ${t.locationName}`}
            >
              <p className="text-sm text-white">{t.problemTitle}</p>
              <p className="text-xs text-slate-400">
                {t.customerStatus} · {t.priority} · Updated {t.updatedAt.slice(0, 10)}
              </p>
              <Link href={`/portal/tickets/${t.id}`} className="mt-2 inline-block text-sm text-cyan-300">
                View ticket →
              </Link>
            </MatrixCard>
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}
