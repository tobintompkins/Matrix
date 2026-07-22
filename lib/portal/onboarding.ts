/**
 * Patch 51B — Portal onboarding state (first-time customer users).
 */

import { prisma } from "@/lib/db/prisma";

export type OnboardingSteps = {
  welcome: boolean;
  contactConfirmed: boolean;
  notificationPrefs: boolean;
  locationsReviewed: boolean;
  equipmentReviewed: boolean;
  termsAccepted: boolean;
};

const DEFAULT_STEPS: OnboardingSteps = {
  welcome: false,
  contactConfirmed: false,
  notificationPrefs: false,
  locationsReviewed: false,
  equipmentReviewed: false,
  termsAccepted: false,
};

function parseSteps(raw: string | null | undefined): OnboardingSteps {
  if (!raw) return { ...DEFAULT_STEPS };
  try {
    return { ...DEFAULT_STEPS, ...(JSON.parse(raw) as Partial<OnboardingSteps>) };
  } catch {
    return { ...DEFAULT_STEPS };
  }
}

export async function getPortalOnboarding(membershipId: string) {
  const row = await prisma.portalOnboardingState.findUnique({
    where: { membershipId },
  });
  if (!row) {
    return {
      completed: false,
      steps: { ...DEFAULT_STEPS },
      termsAcceptedAt: null as string | null,
      completedAt: null as string | null,
    };
  }
  const steps = parseSteps(row.stepsJson);
  return {
    completed: Boolean(row.completedAt),
    steps,
    termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function updatePortalOnboarding(input: {
  membershipId: string;
  steps?: Partial<OnboardingSteps>;
  acceptTerms?: boolean;
  complete?: boolean;
}) {
  const current = await getPortalOnboarding(input.membershipId);
  const steps: OnboardingSteps = {
    ...current.steps,
    ...(input.steps ?? {}),
  };
  if (input.acceptTerms) {
    steps.termsAccepted = true;
  }

  const allDone =
    input.complete === true ||
    (steps.welcome &&
      steps.contactConfirmed &&
      steps.notificationPrefs &&
      steps.locationsReviewed &&
      steps.equipmentReviewed &&
      steps.termsAccepted);

  const termsAcceptedAt = input.acceptTerms
    ? new Date()
    : current.termsAcceptedAt
      ? new Date(current.termsAcceptedAt)
      : null;

  const row = await prisma.portalOnboardingState.upsert({
    where: { membershipId: input.membershipId },
    create: {
      membershipId: input.membershipId,
      stepsJson: JSON.stringify(steps),
      termsAcceptedAt,
      completedAt: allDone ? new Date() : null,
    },
    update: {
      stepsJson: JSON.stringify(steps),
      ...(input.acceptTerms ? { termsAcceptedAt: new Date() } : {}),
      ...(allDone ? { completedAt: new Date() } : {}),
    },
  });

  return {
    completed: Boolean(row.completedAt),
    steps: parseSteps(row.stepsJson),
    termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
