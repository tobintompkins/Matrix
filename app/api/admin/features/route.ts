import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { ensureAdminFoundationSeeded, writeAdminAudit } from "@/lib/admin/repository";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_FEATURE_CONTROLS");
  if (denied) return denied;
  await ensureAdminFoundationSeeded(actor.organizationId);
  const features = await prisma.adminFeatureControl.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { featureKey: "asc" },
  });
  return NextResponse.json({ ok: true, features });
}

export async function PATCH(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_FEATURE_CONTROLS");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    enabled?: boolean;
  };
  if (!body.id || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "id and enabled are required." },
      { status: 400 },
    );
  }

  const existing = await prisma.adminFeatureControl.findUnique({
    where: { id: body.id },
  });
  if (!existing || existing.organizationId !== actor.organizationId) {
    return NextResponse.json({ ok: false, error: "Feature not found." }, { status: 404 });
  }

  const updated = await prisma.adminFeatureControl.update({
    where: { id: body.id },
    data: {
      enabled: body.enabled,
      updatedByUserId: actor.userId,
    },
  });

  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "FEATURE_CONTROL_UPDATED",
    entityId: updated.id,
    payload: {
      featureKey: updated.featureKey,
      previous: existing.enabled,
      next: updated.enabled,
    },
  });

  return NextResponse.json({
    ok: true,
    feature: updated,
    notice:
      updated.featureKey === "matrix_assist" && !updated.enabled
        ? "Disabling Matrix Assist will remove new AI assistance actions. Existing diagnostic history will remain available to authorized users."
        : "Feature state updated. Existing feature data is retained.",
  });
}
