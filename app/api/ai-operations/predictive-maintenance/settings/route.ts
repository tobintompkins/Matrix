import { NextResponse } from "next/server";
import { forbidUnlessAi, resolveAiActor } from "@/lib/ai/auth";
import {
  getOrCreateDefaultScoringProfile,
  getOrCreatePredictiveSettings,
  settingsToDefaults,
  updatePredictiveSettings,
} from "@/lib/predictive-maintenance/settings";
import {
  parseScoringWeights,
  applyProfileThresholds,
} from "@/lib/predictive-maintenance/scoring-profile";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { DEFAULT_WEIGHTS } from "@/lib/predictive-maintenance/types";
import { evaluateMachineDeterministic } from "@/lib/predictive-maintenance/scoring-engine";
import { gatherMachinePredictiveInput } from "@/lib/predictive-maintenance/gather-input";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "VIEW_PREDICTIVE_MAINTENANCE");
  if (denied) return denied;

  const settings = await getOrCreatePredictiveSettings(DEFAULT_ORG_ID);
  const profile = await getOrCreateDefaultScoringProfile(DEFAULT_ORG_ID);
  return NextResponse.json({ ok: true, settings, profile });
}

export async function PATCH(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_PREDICTIVE_SETTINGS");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updated = await updatePredictiveSettings(
    DEFAULT_ORG_ID,
    body as Parameters<typeof updatePredictiveSettings>[1],
    actor.userId,
  );
  return NextResponse.json({ ok: true, settings: updated });
}

/** Preview scoring against a machine without persisting. */
export async function POST(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_PREDICTIVE_SCORING");
  if (denied) {
    const viewDenied = forbidUnlessAi(actor, "VIEW_PREDICTIVE_MAINTENANCE");
    if (viewDenied) return denied;
  }

  const body = (await request.json().catch(() => ({}))) as {
    machineId?: string;
  };
  if (!body.machineId) {
    return NextResponse.json(
      { ok: false, error: "machineId required for preview." },
      { status: 400 },
    );
  }
  const settings = applyProfileThresholds(
    settingsToDefaults(await getOrCreatePredictiveSettings(DEFAULT_ORG_ID)),
    (await getOrCreateDefaultScoringProfile(DEFAULT_ORG_ID)).thresholdsJson,
  );
  const profile = await getOrCreateDefaultScoringProfile(DEFAULT_ORG_ID);
  const weights = parseScoringWeights(profile.weightsJson);
  const input = await gatherMachinePredictiveInput(body.machineId);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Machine not found." }, { status: 404 });
  }
  const result = evaluateMachineDeterministic(input, settings, weights);
  return NextResponse.json({
    ok: true,
    preview: true,
    result,
    weights,
    note: "Preview only — historical snapshots are not rewritten.",
  });
}

export async function PUT(request: Request) {
  const actor = await resolveAiActor();
  const denied = forbidUnlessAi(actor, "MANAGE_PREDICTIVE_SCORING");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    weightsJson?: string;
    thresholdsJson?: string;
    reset?: boolean;
  };

  const profile = await getOrCreateDefaultScoringProfile(DEFAULT_ORG_ID);
  const nextVersion = String(Number(profile.version || "1") + 1);
  const updated = await prisma.predictiveScoringProfile.update({
    where: { id: profile.id },
    data: {
      weightsJson: body.reset
        ? JSON.stringify(DEFAULT_WEIGHTS)
        : (body.weightsJson ?? profile.weightsJson),
      thresholdsJson: body.thresholdsJson ?? profile.thresholdsJson,
      version: nextVersion,
      updatedById: actor.userId,
    },
  });

  // Bump settings scoring version so new snapshots are tagged
  await updatePredictiveSettings(
    DEFAULT_ORG_ID,
    { scoringVersion: `pm-pred-v${nextVersion}` },
    actor.userId,
  );

  return NextResponse.json({
    ok: true,
    profile: updated,
    warning: "New scoring version applies to future evaluations only.",
  });
}
