import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { writeAdminAudit } from "@/lib/admin/repository";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_CENTER");
  if (denied) return denied;
  const { id } = await ctx.params;
  const row = await prisma.dataQualityRule.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!row) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, rule: row });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "EDIT_DATA_QUALITY_RULE");
  if (denied) return denied;
  const { id } = await ctx.params;
  const existing = await prisma.dataQualityRule.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const body = (await req.json()) as {
    name?: string;
    description?: string;
    severity?: string;
    priority?: number;
    configuration?: Record<string, unknown>;
  };
  const updated = await prisma.dataQualityRule.update({
    where: { id },
    data: {
      name: body.name?.slice(0, 200),
      description: body.description?.slice(0, 2000),
      severity: body.severity,
      priority: body.priority,
      configurationJson:
        body.configuration !== undefined
          ? JSON.stringify(body.configuration)
          : undefined,
      updatedByUserId: actor.userId,
    },
  });
  await writeAdminAudit({
    organizationId: actor.organizationId,
    actorId: actor.userId,
    action: "DATA_QUALITY_RULE_UPDATED",
    entityType: "DataQualityRule",
    entityId: id,
  });
  return NextResponse.json({ ok: true, id: updated.id });
}
