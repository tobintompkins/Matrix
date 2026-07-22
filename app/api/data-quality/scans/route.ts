import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { prisma } from "@/lib/db/prisma";
import { runDataQualityScan, serializeScan } from "@/lib/data-quality/scan";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_CENTER");
  if (denied) return denied;
  const rows = await prisma.dataQualityScan.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    ok: true,
    items: rows.map(serializeScan),
  });
}

export async function POST(req: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "RUN_DATA_QUALITY_SCAN");
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    scanType?: string;
    modules?: string[];
  };
  const result = await runDataQualityScan({
    actor,
    scanType: body.scanType ?? "MANUAL",
    modules: body.modules,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
