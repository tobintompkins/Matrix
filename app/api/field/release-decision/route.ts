import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { getLatestFieldDeviceVerificationSubmission } from "@/lib/field/device-verification-submission";
import {
  expectedFieldReleaseDecisionConfirmation,
  type FieldReleaseDecision,
} from "@/lib/field/field-release-decision";
import { recordFieldReleaseDecision } from "@/lib/field/field-release-decision-audit";
import { buildFieldReleaseReadinessFromLatestSubmission } from "@/lib/field/field-release-readiness";

/** Manager-only audited approve / hold / revoke for Field release readiness. */
export async function POST(request: Request) {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }

  let body: { decision?: unknown; note?: unknown; confirmation?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const decision = body.decision;
  if (decision !== "approve" && decision !== "hold" && decision !== "revoke") {
    return NextResponse.json(
      { ok: false, error: "Provide decision approve, hold, or revoke." },
      { status: 400 },
    );
  }

  const expectedConfirmation = expectedFieldReleaseDecisionConfirmation(
    decision as FieldReleaseDecision,
  );
  if (body.confirmation !== expectedConfirmation) {
    return NextResponse.json(
      { ok: false, error: "Confirmation text does not match the requested decision." },
      { status: 400 },
    );
  }

  const latest = await getLatestFieldDeviceVerificationSubmission();
  const readiness = buildFieldReleaseReadinessFromLatestSubmission(latest);

  if (decision === "approve" && readiness.state !== "ready") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Approve is allowed only when the latest finalized verification is release-ready (all scenarios passed). Use hold or revoke otherwise.",
      },
      { status: 409 },
    );
  }

  const note = typeof body.note === "string" ? body.note : undefined;
  const decisionRecord = await recordFieldReleaseDecision({
    decision: decision as FieldReleaseDecision,
    readiness,
    actorId: authResult.userId,
    actorDisplayName: authResult.profile.displayName?.trim() || authResult.userId,
    actorEmail: authResult.profile.email,
    note,
    sourceRoute: "/api/field/release-decision",
  });

  return NextResponse.json({
    ok: true,
    decision: decisionRecord,
    readiness,
  });
}
