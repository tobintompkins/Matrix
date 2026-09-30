import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { prisma } from "@/lib/db/prisma";
import {
  FIELD_SYNC_PROCESS_AUDIT_ACTION,
  FIELD_SYNC_PROCESS_AUDIT_ENTITY_ID,
  FIELD_SYNC_PROCESS_AUDIT_ENTITY_TYPE,
  mapFieldSyncProcessRun,
} from "@/lib/field/field-sync-process-audit";

/** Manager-only, read-only Field receipt processor run history. */
export async function GET() {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }

  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: FIELD_SYNC_PROCESS_AUDIT_ENTITY_TYPE,
      entityId: FIELD_SYNC_PROCESS_AUDIT_ENTITY_ID,
      action: FIELD_SYNC_PROCESS_AUDIT_ACTION,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, createdAt: true, payload: true },
  });

  return NextResponse.json({
    ok: true,
    runs: rows.map(mapFieldSyncProcessRun),
  });
}
