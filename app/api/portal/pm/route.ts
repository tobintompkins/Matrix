import { NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import {
  getAuthorizedPrinterIds,
  setActivePortalMembership,
} from "@/lib/portal/repository";
import { listMeterTableRows } from "@/lib/pm-intelligence";
import { mapPmStatusForPortal } from "@/lib/portal/serializers";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_PM");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);
  if (!gate.membership.canViewPm) {
    return NextResponse.json(
      { ok: false, error: "PM access is not permitted." },
      { status: 403 },
    );
  }
  const allowed = new Set(getAuthorizedPrinterIds(gate.membership));
  const items = listMeterTableRows()
    .filter((r) => allowed.has(r.printerId))
    .map((r) => ({
      id: r.printerId,
      machineId: r.printerId,
      machineName: r.machineName,
      locationName: r.siteName,
      pmType: "Preventive Maintenance",
      currentMeter: r.currentMeter,
      nextPmMeter: r.nextPmCount,
      scheduledDate: r.estimatedPmDate,
      status: mapPmStatusForPortal(r.pmStatus),
      lastCompleted: r.lastCountDate,
    }));
  return NextResponse.json({ ok: true, items });
}
