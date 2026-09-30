import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { prisma } from "@/lib/db/prisma";
import { buildTechnicianIdCoverage } from "@/lib/field/technician-id-coverage";

/** Manager-only read-only durable technician-ID assignment coverage. */
export async function GET() {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }
  const rows = await prisma.workOrder.findMany({
    orderBy: { updatedAt: "desc" },
    take: 250,
    select: {
      id: true, workOrderNumber: true, assignedTechnician: true, assignedTechnicianId: true,
      secondaryTechnician: true, secondaryTechnicianId: true,
    },
  });
  return NextResponse.json({ ok: true, coverage: buildTechnicianIdCoverage(rows) });
}
