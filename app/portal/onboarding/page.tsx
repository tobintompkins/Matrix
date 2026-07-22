"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PortalShell from "../PortalShell";
import { MatrixButton, MatrixCard } from "../../components/ui";

type Steps = {
  welcome: boolean;
  contactConfirmed: boolean;
  notificationPrefs: boolean;
  locationsReviewed: boolean;
  equipmentReviewed: boolean;
  termsAccepted: boolean;
};

const STEP_COPY: Array<{ key: keyof Steps; title: string; body: string }> = [
  {
    key: "welcome",
    title: "Welcome",
    body: "Use this portal to manage service requests, equipment, meters, and documents for your account.",
  },
  {
    key: "contactConfirmed",
    title: "Confirm contact information",
    body: "Verify your phone and preferred contact method under Profile when ready. Optional fields will not block access.",
  },
  {
    key: "notificationPrefs",
    title: "Notification preferences",
    body: "Choose how you want updates about service, PM, meters, and parts. You can change these anytime.",
  },
  {
    key: "locationsReviewed",
    title: "Authorized locations",
    body: "You will only see locations your administrator has authorized for your portal account.",
  },
  {
    key: "equipmentReviewed",
    title: "Authorized equipment",
    body: "Equipment lists are limited to machines in your authorized locations or explicit machine grants.",
  },
  {
    key: "termsAccepted",
    title: "Accept terms",
    body: "Confirm you accept the portal terms of use and privacy notice for your organization.",
  },
];

export default function PortalOnboardingPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<Steps | null>(null);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/portal/onboarding");
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Unable to load onboarding.");
        return;
      }
      if (json.completed) {
        router.replace("/portal/dashboard");
        return;
      }
      setSteps(json.steps as Steps);
      const firstIncomplete = STEP_COPY.findIndex(
        (s) => !(json.steps as Steps)[s.key],
      );
      setIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    })();
  }, [router]);

  async function advance(acceptTerms = false) {
    if (!steps) return;
    setBusy(true);
    setError(null);
    const current = STEP_COPY[index];
    const nextSteps = { ...steps, [current.key]: true };
    try {
      const res = await fetch("/api/portal/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: nextSteps,
          acceptTerms: acceptTerms || current.key === "termsAccepted",
          complete: index >= STEP_COPY.length - 1,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Update failed");
      setSteps(json.steps as Steps);
      if (json.completed || index >= STEP_COPY.length - 1) {
        router.push("/portal/dashboard");
        return;
      }
      setIndex((i) => Math.min(i + 1, STEP_COPY.length - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const step = STEP_COPY[index];

  return (
    <PortalShell title="Portal onboarding">
      {error ? (
        <p className="mb-4 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {!steps || !step ? (
        <p className="text-sm text-slate-400">Loading onboarding…</p>
      ) : (
        <MatrixCard title={`Step ${index + 1} of ${STEP_COPY.length}: ${step.title}`}>
          <p className="mb-6 text-sm text-slate-300">{step.body}</p>
          <div className="flex flex-wrap gap-3">
            <MatrixButton
              type="button"
              disabled={busy}
              onClick={() => void advance(step.key === "termsAccepted")}
            >
              {step.key === "termsAccepted" ? "Accept and continue" : "Continue"}
            </MatrixButton>
            {step.key !== "termsAccepted" ? (
              <MatrixButton
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void advance()}
              >
                Skip for now
              </MatrixButton>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Optional profile fields never permanently block portal access.
          </p>
        </MatrixCard>
      )}
    </PortalShell>
  );
}
