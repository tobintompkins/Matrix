import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/prisma";
import { serializeScan } from "@/lib/data-quality/scan";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_CENTER");
  if (denied) return denied;
  const { id } = await ctx.params;
  const row = await prisma.dataQualityScan.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!row) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, scan: serializeScan(row) });
}
