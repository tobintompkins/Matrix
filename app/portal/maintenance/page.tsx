"use client";

import { MatrixCard, MatrixButton } from "../../components/ui";
import PortalShell from "../PortalShell";
import { listPortalPrinters, requestPmScheduling } from "@/lib/portal";
import { useState } from "react";

export default function PortalMaintenancePage() {
  const printers = listPortalPrinters();
  const [notice, setNotice] = useState("");

  return (
    <PortalShell title="Maintenance">
      {notice ? <p className="mb-4 text-sm text-cyan-200">{notice}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {printers.map((p) => (
          <MatrixCard key={p.id} title={p.name} subtitle={p.locationName}>
            <p className="text-sm text-slate-300">
              PM status: {p.nextPmEstimate ?? "Not visible"}
            </p>
            <p className="text-xs text-slate-500">
              Meter: {p.meter?.toLocaleString() ?? "Hidden by permission"}
            </p>
            <MatrixButton
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                const r = requestPmScheduling(p.id, "Customer requested PM scheduling");
                setNotice(r.ok ? "Scheduling request sent to dispatch" : r.error ?? "Failed");
              }}
            >
              Request scheduling
            </MatrixButton>
          </MatrixCard>
        ))}
      </div>
    </PortalShell>
  );
}
