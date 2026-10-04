import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { recordFieldSyncProcessRun } from "@/lib/field/field-sync-process-audit";
import {
  processReceivedFieldAttachments,
  processReceivedFieldCompletions,
  processReceivedFieldCopyCounts,
  processReceivedFieldMaintenanceCompletions,
  processReceivedFieldWorkSessions,
  processReceivedFieldNotes,
  processReceivedFieldParts,
  processReceivedFieldPhotos,
  processReceivedFieldSignatures,
  processReceivedFieldStatuses,
} from "@/lib/field/server-sync-processor";

/** Manager-only: apply validated Field receipts including signatures and copy counts. */
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
  const copyCounts = await processReceivedFieldCopyCounts(limit);
  const maintenance = await processReceivedFieldMaintenanceCompletions(limit);
  const workSessions = await processReceivedFieldWorkSessions(limit);
  const photos = await processReceivedFieldPhotos(limit);
  const attachments = await processReceivedFieldAttachments(limit);
  const signatures = await processReceivedFieldSignatures(limit);
  const parts = await processReceivedFieldParts(limit);
  const results = { notes, statuses, completions, copyCounts, maintenance, workSessions, photos, attachments, signatures, parts };
  let auditWarning: string | null = null;
  try {
    await recordFieldSyncProcessRun({
      actorId: authResult.userId,
      actorDisplayName: authResult.profile.displayName?.trim() || authResult.userId,
      limit,
      results,
    });
  } catch {
    auditWarning = "Receipt processing completed, but its audit record could not be saved.";
  }
  return NextResponse.json({ ok: true, ...results, auditWarning });
}
