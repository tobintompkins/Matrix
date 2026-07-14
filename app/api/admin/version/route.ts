import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { getVersionInformation } from "@/lib/admin/completion/version";

export async function GET() {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "VIEW_VERSION_INFORMATION");
  if (denied) return denied;
  return NextResponse.json({ ok: true, data: getVersionInformation() });
}
