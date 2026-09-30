import { NextResponse } from "next/server";
import { requireMatrixPermission } from "@/lib/auth/server";
import { hasConfiguredFieldApiIdentity } from "@/lib/field/api-authorization";
import { getLatestFieldDeviceVerificationSubmission } from "@/lib/field/device-verification-submission";
import {
  getLatestFieldReleaseDecision,
  listRecentFieldReleaseDecisions,
} from "@/lib/field/field-release-decision-audit";
import { buildFieldReleaseEvidence } from "@/lib/field/field-release-evidence";
import { buildFieldReleaseReadinessFromLatestSubmission } from "@/lib/field/field-release-readiness";

/** Manager-only, read-only Field release evidence export. */
export async function GET() {
  const authResult = await requireMatrixPermission("VIEW_FIELD_ALL_TECHNICIANS");
  if (!authResult.ok) return authResult.response;
  if (!hasConfiguredFieldApiIdentity(authResult.profile)) {
    return NextResponse.json({ ok: false, error: "A configured Matrix role is required." }, { status: 403 });
  }

  const latestVerification = await getLatestFieldDeviceVerificationSubmission();
  const [latestDecision, recentDecisions] = await Promise.all([
    getLatestFieldReleaseDecision(),
    listRecentFieldReleaseDecisions(25),
  ]);

  return NextResponse.json({
    ok: true,
    evidence: buildFieldReleaseEvidence({
      readiness: buildFieldReleaseReadinessFromLatestSubmission(latestVerification),
      latestVerification,
      latestDecision,
      recentDecisions,
    }),
  });
}
