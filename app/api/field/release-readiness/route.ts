import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { getLatestFieldDeviceVerificationSubmission } from "@/lib/field/device-verification-submission";
import {
  getLatestFieldReleaseDecision,
  listRecentFieldReleaseDecisions,
} from "@/lib/field/field-release-decision-audit";
import { buildFieldReleaseReadinessFromLatestSubmission } from "@/lib/field/field-release-readiness";

/** Manager-only Field release readiness and decision history (read-only for verification data). */
export async function GET() {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }

  const latest = await getLatestFieldDeviceVerificationSubmission();
  const readiness = buildFieldReleaseReadinessFromLatestSubmission(latest);

  const latestDecision = await getLatestFieldReleaseDecision();
  const recentDecisions = await listRecentFieldReleaseDecisions(10);

  return NextResponse.json({
    ok: true,
    readiness,
    latestSubmission: latest,
    latestDecision,
    recentDecisions,
  });
}
