import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import { portalDownloadDocument } from "@/lib/portal/enterprise";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const gate = await requirePortalAccess("DOWNLOAD_CUSTOMER_DOCUMENTS");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  const result = await portalDownloadDocument(
    gate.membership,
    id,
    gate.actor.organizationId,
  );
  if (!result.ok) return portalNotFound();
  return NextResponse.json(result);
}
