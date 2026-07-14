import { NextResponse } from "next/server";
import { forbidUnless, resolveAdminActor } from "@/lib/admin/auth";
import { listAdminUsers } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await resolveAdminActor();
  const denied = forbidUnless(actor, "MANAGE_USERS");
  if (denied) return denied;

  const url = new URL(request.url);
  const regionScope =
    actor.role === "REGIONAL_MANAGER" ? actor.regionId : null;

  try {
    const result = await listAdminUsers({
      organizationId: actor.organizationId,
      regionId: regionScope,
      q: url.searchParams.get("q") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to load users.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
