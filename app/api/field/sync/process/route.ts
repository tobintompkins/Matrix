import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { processReceivedFieldNotes } from "@/lib/field/server-sync-processor";

/** Manager-only, deliberately limited to the safe NOTE receipt processor. */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }
  let body: { limit?: unknown } = {};
  try { body = await request.json(); } catch { /* empty body is valid */ }
  const requested = typeof body.limit === "number" ? body.limit : 25;
  const result = await processReceivedFieldNotes(Math.max(1, Math.min(50, Math.floor(requested))));
  return NextResponse.json({ ok: true, ...result });
}
