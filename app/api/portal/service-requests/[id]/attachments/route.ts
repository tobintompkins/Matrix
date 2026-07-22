import { NextResponse } from "next/server";
import { requirePortalAccess, portalNotFound } from "@/lib/portal/auth";
import { uploadPortalServiceAttachment } from "@/lib/portal/attachments";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { writeAdminAudit } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const gate = await requirePortalAccess("UPLOAD_CUSTOMER_SERVICE_ATTACHMENT");
  if (!gate.ok) return gate.response;
  const { id: ticketId } = await context.params;
  try {
    setActivePortalMembership(gate.membership.id);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "file is required." },
        { status: 400 },
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const caption =
      typeof form.get("caption") === "string"
        ? String(form.get("caption"))
        : undefined;

    const result = await uploadPortalServiceAttachment({
      membership: gate.membership,
      organizationId: gate.actor.organizationId,
      ticketId,
      fileName: file.name || "upload.bin",
      mimeType: file.type || "application/octet-stream",
      bytes,
      caption,
    });
    if (!result.ok) {
      if (result.error === "Record not available.") return portalNotFound();
      return NextResponse.json(result, { status: 400 });
    }

    await writeAdminAudit({
      organizationId: gate.actor.organizationId,
      actorId: gate.actor.userId,
      action: "PORTAL_ATTACHMENT_UPLOADED",
      entityType: "ServiceCall",
      entityId: ticketId,
      payload: {
        customerId: gate.membership.customerId,
        attachmentId: result.attachment.id,
        fileName: result.attachment.fileName,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
}
