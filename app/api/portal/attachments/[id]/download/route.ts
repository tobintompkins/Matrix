import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import { authorizePortalAttachmentDownload } from "@/lib/portal/attachments";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const gate = await requirePortalAccess("DOWNLOAD_CUSTOMER_DOCUMENTS");
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  setActivePortalMembership(gate.membership.id);
  const result = await authorizePortalAttachmentDownload({
    membership: gate.membership,
    attachmentId: id,
  });
  if (!result.ok) return portalNotFound();

  await writeAdminAudit({
    organizationId: gate.actor.organizationId,
    actorId: gate.actor.userId,
    action: "PORTAL_ATTACHMENT_DOWNLOADED",
    entityType: "PortalAttachment",
    entityId: id,
    payload: { customerId: gate.membership.customerId },
  });

  return new NextResponse(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "Content-Type": result.entry.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${result.entry.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
