import { NextRequest, NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { getPredictiveBusinessAnalytics } from "@/lib/executive-command-center/predictive-business";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const actor = await resolveAiActor();
  const deniedAnalytics = forbidUnlessAi(actor, "VIEW_EXECUTIVE_ANALYTICS");
  if (deniedAnalytics) {
    const deniedEcc = forbidUnlessAi(actor, "VIEW_EXECUTIVE_COMMAND_CENTER");
    if (deniedEcc) return deniedEcc;
  }

  try {
    const horizon = req.nextUrl.searchParams.get("horizon");
    const payload = await getPredictiveBusinessAnalytics({
      organizationId: DEFAULT_ORG_ID,
      horizon,
    });
    return NextResponse.json({ ok: true, analytics: payload });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Failed to load predictive business analytics.",
      },
      { status: 500 },
    );
  }
}
