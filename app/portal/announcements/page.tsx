"use client";

import { MatrixCard } from "../../components/ui";
import PortalShell from "../PortalShell";
import { listPortalAnnouncements } from "@/lib/portal";

export default function PortalAnnouncementsPage() {
  const items = listPortalAnnouncements();
  return (
    <PortalShell title="Announcements">
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id}>
            <MatrixCard title={a.title} subtitle={a.priority}>
              <p className="text-sm text-slate-300">{a.message}</p>
            </MatrixCard>
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}
