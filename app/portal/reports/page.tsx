"use client";

import { MatrixCard, MatrixButton } from "../../components/ui";
import PortalShell from "../PortalShell";
import { listPortalReports } from "@/lib/portal";

export default function PortalReportsPage() {
  const reports = listPortalReports();

  return (
    <PortalShell title="Service reports">
      <ul className="space-y-3">
        {reports.map((r) => (
          <li key={r.id}>
            <MatrixCard
              title={r.ticketNumber}
              subtitle={`${r.reportType} · ${r.reportDate.slice(0, 10)}`}
            >
              <p className="text-sm text-slate-300">
                {r.printer} · {r.location} · {r.technician || "—"}
              </p>
              <MatrixButton
                href={`/portal/tickets/${r.id}`}
                variant="secondary"
                size="sm"
                className="mt-2"
              >
                View / print
              </MatrixButton>
            </MatrixCard>
          </li>
        ))}
        {reports.length === 0 ? (
          <p className="text-slate-400">No approved reports available.</p>
        ) : null}
      </ul>
    </PortalShell>
  );
}
