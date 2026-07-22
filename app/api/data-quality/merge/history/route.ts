import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { listMergeHistory } from "@/lib/data-quality/merge";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_DATA_QUALITY_HISTORY");
  if (denied) return denied;
  const items = await listMergeHistory(actor.organizationId);
  return NextResponse.json({ ok: true, items });
}
