import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { getServerFieldBridgeRollout } from "@/lib/work-orders/server-field-repository";
import { getServerFieldWorkOrderReadiness } from "@/lib/work-orders/server-field-readiness";
import { prisma } from "@/lib/db/prisma";

/** Manager-only read-only status for the controlled Field bridge rollout. */
export async function GET() {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }
  const readiness = await getServerFieldWorkOrderReadiness();
  const rollout = getServerFieldBridgeRollout();
  const pilot = rollout.pilotWorkOrder
    ? await prisma.workOrder.findFirst({
        where: {
          OR: [
            { id: rollout.pilotWorkOrder },
            { workOrderNumber: rollout.pilotWorkOrder },
            { legacyWorkOrderId: rollout.pilotWorkOrder },
          ],
        },
        select: { workOrderNumber: true, assignedTechnician: true, scheduledStart: true, status: true },
      })
    : null;
  const pilotReady = Boolean(pilot?.assignedTechnician?.trim() && pilot.scheduledStart && pilot.status?.trim());
  return NextResponse.json({ ok: true, rollout, readiness, pilot: {
    selected: Boolean(rollout.pilotWorkOrder), found: Boolean(pilot), ready: pilotReady,
    workOrderNumber: pilot?.workOrderNumber ?? null,
  } });
}
