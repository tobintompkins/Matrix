import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_PREDICTIVE_HISTORY");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const since = new Date(Date.now() - days * 86_400_000);

  const runs = await prisma.predictiveMaintenanceRun.findMany({
    where: { organizationId: DEFAULT_ORG_ID },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  const snapshots = await prisma.machineHealthSnapshot.findMany({
    where: { organizationId: DEFAULT_ORG_ID, generatedAt: { gte: since } },
    orderBy: { generatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ ok: true, runs, snapshots });
}
