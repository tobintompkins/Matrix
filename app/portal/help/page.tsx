"use client";

import { MatrixCard } from "../../components/ui";
import PortalShell from "../PortalShell";
import { getSupportContact } from "@/lib/portal";

export default function PortalHelpPage() {
  const support = getSupportContact();

  return (
    <PortalShell title="Help & support">
      <div className="grid gap-4 lg:grid-cols-2">
        <MatrixCard title="How to use the portal">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
            <li>Create a service ticket from Tickets → New ticket</li>
            <li>Find serial numbers on the printer label or Printers page</li>
            <li>Add photos from the ticket message area when uploading is enabled</li>
            <li>Track status on the ticket detail timeline</li>
            <li>Approve completed work when you have approval permission</li>
            <li>Download reports from the Reports page</li>
            <li>Request PM scheduling from Maintenance</li>
          </ul>
        </MatrixCard>
        <MatrixCard title="Contact service team">
          <p className="text-sm text-white">{support.teamName}</p>
          <p className="text-sm text-slate-300">{support.hours}</p>
          <p className="mt-2 text-sm">
            <a className="text-cyan-300" href={`tel:${support.phone}`}>
              {support.phone}
            </a>
          </p>
          <p className="text-sm">
            <a className="text-cyan-300" href={`mailto:${support.email}`}>
              {support.email}
            </a>
          </p>
          <p className="mt-3 text-sm text-amber-200">
            Emergency: {support.emergencyPhone}
          </p>
        </MatrixCard>
      </div>
    </PortalShell>
  );
}
