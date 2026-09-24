import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { getServerFieldWorkOrderReadiness } from "@/lib/work-orders/server-field-readiness";

/** Manager-only, read-only preflight for enabling durable Field work orders. */
export async function GET() {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json(
      { ok: false, error: "A configured Matrix role is required." },
      { status: 403 },
    );
  }

  const readiness = await getServerFieldWorkOrderReadiness();
  return NextResponse.json({ ok: true, readiness });
}
