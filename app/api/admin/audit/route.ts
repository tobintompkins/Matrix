import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_AUDIT_HISTORY");
  if (denied) return denied;

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  const where: Record<string, unknown> = {
    organizationId: actor.organizationId,
  };
  if (action) where.action = action;
  if (q) {
    where.OR = [
      { action: { contains: q } },
      { entityId: { contains: q } },
      { entityType: { contains: q } },
    ];
  }

  const events = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    ok: true,
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      actorId: e.actorId,
      createdAt: e.createdAt.toISOString(),
      payload: e.payload,
    })),
  });
}
