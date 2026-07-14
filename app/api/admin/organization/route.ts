import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { ensureAdminFoundationSeeded, writeAdminAudit } from "@/lib/admin/repository";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_ORGANIZATION_SETTINGS");
  if (denied) return denied;
  await ensureAdminFoundationSeeded(actor.organizationId);
  const profile = await prisma.adminOrganizationProfile.findUnique({
    where: { organizationId: actor.organizationId },
  });
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_ORGANIZATION_SETTINGS");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    string | null | undefined
  >;

  await ensureAdminFoundationSeeded(actor.organizationId);
  const existing = await prisma.adminOrganizationProfile.findUnique({
    where: { organizationId: actor.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
  }

  const updated = await prisma.adminOrganizationProfile.update({
    where: { id: existing.id },
    data: {
      legalName: body.legalName ?? existing.legalName,
      displayName: body.displayName ?? existing.displayName,
      supportEmail: body.supportEmail ?? existing.supportEmail,
      supportPhone: body.supportPhone ?? existing.supportPhone,
      website: body.website ?? existing.website,
      address: body.address ?? existing.address,
      defaultTimeZone: body.defaultTimeZone ?? existing.defaultTimeZone,
      dateFormat: body.dateFormat ?? existing.dateFormat,
      timeFormat: body.timeFormat ?? existing.timeFormat,
      defaultRegionId: body.defaultRegionId ?? existing.defaultRegionId,
      defaultWarehouseId: body.defaultWarehouseId ?? existing.defaultWarehouseId,
      businessHours: body.businessHours ?? existing.businessHours,
      updatedByUserId: actor.userId,
    },
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "ORGANIZATION_SETTINGS_UPDATED",
    entityId: updated.id,
    payload: { keys: Object.keys(body) },
  });

  return NextResponse.json({ ok: true, profile: updated });
}
