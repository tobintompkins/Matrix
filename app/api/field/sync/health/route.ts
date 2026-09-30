import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { prisma } from "@/lib/db/prisma";
import { buildFieldSyncOperationsHealth } from "@/lib/field/sync-operations-health";

/** Manager-only, read-only view of Field receipt queue health. */
export async function GET() {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }

  const [groups, oldestReceived] = await Promise.all([
    prisma.offlineOperation.groupBy({
      by: ["type", "status"],
      where: { status: { in: ["RECEIVED", "APPLIED", "REJECTED"] } },
      _count: { _all: true },
    }),
    prisma.offlineOperation.findFirst({
      where: { status: "RECEIVED" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const health = buildFieldSyncOperationsHealth(
    groups.map((group) => ({
      type: group.type,
      status: group.status,
      count: group._count._all,
    })),
    oldestReceived?.createdAt ?? null,
  );

  return NextResponse.json({ ok: true, health });
}
