import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { parseFieldDeviceVerificationRecord } from "@/lib/field/device-verification";
import {
  FIELD_DEVICE_VERIFICATION_FINALIZE_CONFIRMATION,
  createFieldDeviceVerificationSubmission,
  listRecentFieldDeviceVerificationSubmissions,
} from "@/lib/field/device-verification-submission";

/** Manager-only: list recent finalized Field device verification submissions. */
export async function GET(request: Request) {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }

  const limitValue = Number(new URL(request.url).searchParams.get("limit") ?? "12");
  const submissions = await listRecentFieldDeviceVerificationSubmissions(
    Number.isFinite(limitValue) ? limitValue : 12,
  );
  return NextResponse.json({ ok: true, submissions });
}

/** Manager-only: submit one finalized release record from the local checklist draft. */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }

  let body: { draft?: unknown; confirmation?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.confirmation !== FIELD_DEVICE_VERIFICATION_FINALIZE_CONFIRMATION) {
    return NextResponse.json(
      { ok: false, error: 'Confirmation must be "FINALIZE_FIELD_DEVICE_VERIFICATION".' },
      { status: 400 },
    );
  }

  const record = parseFieldDeviceVerificationRecord(body.draft);
  const result = await createFieldDeviceVerificationSubmission({
    record,
    submittedByUserId: authResult.userId,
    submittedByName: authResult.profile.displayName?.trim() || authResult.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, submission: result.submission });
}
