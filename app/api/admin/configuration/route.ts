import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { CONFIGURATION_REGISTRY } from "@/lib/admin/configuration-registry";
import { ensureAdminFoundationSeeded, writeAdminAudit } from "@/lib/admin/repository";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_SYSTEM_CONFIGURATION");
  if (denied) return denied;

  await ensureAdminFoundationSeeded(actor.organizationId);
  const entries = await prisma.adminConfigurationEntry.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: [{ configurationType: "asc" }, { displayOrder: "asc" }],
  });
  const regions = await prisma.adminRegion.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { displayOrder: "asc" },
  });

  return NextResponse.json({
    ok: true,
    registry: CONFIGURATION_REGISTRY,
    entries,
    regions,
  });
}

export async function PATCH(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_SYSTEM_CONFIGURATION");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    label?: string;
    description?: string;
    active?: boolean;
    displayOrder?: number;
    reason?: string;
  };

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
  }

  const existing = await prisma.adminConfigurationEntry.findUnique({
    where: { id: body.id },
  });
  if (!existing || existing.organizationId !== actor.organizationId) {
    return NextResponse.json({ ok: false, error: "Configuration not found." }, { status: 404 });
  }

  if (existing.protected && body.active === false) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "System required values cannot be deactivated. Built-in configuration is protected.",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.adminConfigurationEntry.update({
    where: { id: body.id },
    data: {
      label: body.label ?? existing.label,
      description:
        body.description === undefined ? existing.description : body.description,
      active: body.active ?? existing.active,
      displayOrder: body.displayOrder ?? existing.displayOrder,
    },
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "SYSTEM_CONFIGURATION_UPDATED",
    entityId: updated.id,
    payload: {
      previous: {
        label: existing.label,
        active: existing.active,
        displayOrder: existing.displayOrder,
      },
      next: {
        label: updated.label,
        active: updated.active,
        displayOrder: updated.displayOrder,
      },
      reason: body.reason ?? null,
    },
  });

  return NextResponse.json({ ok: true, entry: updated });
}
