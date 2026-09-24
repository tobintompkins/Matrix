import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import {
  processReceivedFieldAttachments,
  processReceivedFieldCompletions,
  processReceivedFieldNotes,
  processReceivedFieldParts,
  processReceivedFieldPhotos,
  processReceivedFieldStatuses,
} from "@/lib/field/server-sync-processor";

/** Manager-only: apply validated field sync receipts (notes, statuses, completions, photos, attachments, parts). */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }
  let body: { limit?: unknown } = {};
  try { body = await request.json(); } catch { /* empty body is valid */ }
  const requested = typeof body.limit === "number" ? body.limit : 25;
  const limit = Math.max(1, Math.min(50, Math.floor(requested)));
  const notes = await processReceivedFieldNotes(limit);
  const statuses = await processReceivedFieldStatuses(limit);
  const completions = await processReceivedFieldCompletions(limit);
  const photos = await processReceivedFieldPhotos(limit);
  const attachments = await processReceivedFieldAttachments(limit);
  const parts = await processReceivedFieldParts(limit);
  return NextResponse.json({ ok: true, notes, statuses, completions, photos, attachments, parts });
}
