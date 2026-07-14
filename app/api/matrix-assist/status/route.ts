import { NextResponse } from "next/server";
import {
  forbidUnless,
  resolveMatrixAssistActor,
} from "@/lib/matrix-assist/auth";
import {
  getMatrixAssistPublicStatus,
  MATRIX_ASSIST_DISCLAIMER,
  MATRIX_ASSIST_SUBTITLE,
} from "@/lib/matrix-assist/config";
import { getOrCreateSettings } from "@/lib/matrix-assist/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveMatrixAssistActor();
  const denied = forbidUnless(actor, "USE_MATRIX_ASSIST");
  // Status is readable even without permission so UI can hide cleanly —
  // but still require at least a signed-in / dev actor path.
  const envStatus = getMatrixAssistPublicStatus();
  let settingsEnabled = true;
  let disclaimer = MATRIX_ASSIST_DISCLAIMER;
  try {
    const settings = await getOrCreateSettings(actor.organizationId);
    settingsEnabled = settings.enabled;
    if (settings.disclaimerOverride) disclaimer = settings.disclaimerOverride;
  } catch {
    // DB may not be migrated yet
  }

  const enabled = envStatus.enabled && settingsEnabled;
  return NextResponse.json({
    ok: true,
    enabled,
    configured: envStatus.configured && enabled,
    provider: envStatus.provider,
    sampleMode: envStatus.sampleMode,
    message: !enabled
      ? "Matrix Assist is disabled in this environment."
      : envStatus.message,
    subtitle: MATRIX_ASSIST_SUBTITLE,
    disclaimer,
    canUse: !denied && enabled,
    permissionDenied: Boolean(denied),
  });
}
