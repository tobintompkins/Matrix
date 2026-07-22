import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { getDecisionSummary, serializeDecision } from "@/lib/decision-engine";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_DECISION_CENTER");
  if (denied) return denied;

  const includeCosts = hasMatrixPermission(actor.role, "VIEW_DECISION_COSTS");
  const summary = await getDecisionSummary(DEFAULT_ORG_ID);

  return NextResponse.json({
    ok: true,
    summary: {
      ...summary,
      estimatedCostAvoided: includeCosts ? summary.estimatedCostAvoided : null,
      estimatedCostExposure: includeCosts
        ? summary.estimatedCostExposure
        : null,
      costsHidden: !includeCosts,
      topDecisions: summary.topDecisions.map((d) =>
        serializeDecision(d, { includeCosts }),
      ),
      slaThreats: summary.slaThreats.map((d) =>
        serializeDecision(d, { includeCosts }),
      ),
    },
    empty: summary.empty,
    emptyMessage: summary.empty
      ? "No decisions yet. Run the Decision Engine to generate recommendations from current fleet, service, PM, predictive, and inventory signals."
      : null,
  });
}
