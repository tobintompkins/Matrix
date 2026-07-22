import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getSystemLogsSummary } from "@/lib/system-logs/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_SYSTEM_LOGS");
  if (denied) return denied;
  try {
    return NextResponse.json(await getSystemLogsSummary(actor));
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed." },
      { status: 500 },
    );
  }
}
