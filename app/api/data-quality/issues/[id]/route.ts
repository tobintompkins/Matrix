import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { serializeIssue } from "@/lib/data-quality/scan";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_ISSUES");
  if (denied) return denied;
  const { id } = await ctx.params;
  const row = await prisma.dataQualityIssue.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }
  const sensitive = hasMatrixPermission(
    actor.role,
    "VIEW_DATA_QUALITY_SENSITIVE_DETAILS",
  );
  return NextResponse.json({
    ok: true,
    issue: serializeIssue(row, sensitive),
  });
}
