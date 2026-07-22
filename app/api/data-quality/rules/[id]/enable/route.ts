import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "ENABLE_DATA_QUALITY_RULE");
  if (denied) return denied;
  const { id } = await ctx.params;
  const existing = await prisma.dataQualityRule.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  await prisma.dataQualityRule.update({
    where: { id },
    data: { isActive: true, updatedByUserId: actor.userId },
  });
  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "DATA_QUALITY_RULE_ENABLED",
    entityType: "DataQualityRule",
    entityId: id,
  });
  return NextResponse.json({ ok: true });
}
