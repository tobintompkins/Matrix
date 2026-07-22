"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Live predictive risk chip for machine entry points (SC / PM pages).
 * Fail-open: shows a static link if the snapshot cannot be loaded.
 */
export default function PredictiveMachineChip({
  machineId,
  className = "",
}: {
  machineId: string;
  className?: string;
}) {
  const [chip, setChip] = useState<{
    healthScore: number;
    riskLevel: string;
  } | null>(null);

  useEffect(() => {
    if (!machineId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/ai-operations/predictive-maintenance/machines/${encodeURIComponent(machineId)}`,
          { cache: "no-store" },
        );
        const json = await res.json();
        if (cancelled || !res.ok || !json.ok) return;
        const snap = json.latest ?? null;
        if (snap && typeof snap.healthScore === "number") {
          setChip({
            healthScore: snap.healthScore,
            riskLevel: String(snap.riskLevel ?? "UNKNOWN"),
          });
        }
      } catch {
        /* fail open */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [machineId]);

  const href = `/ai-operations/predictive-maintenance/machines/${encodeURIComponent(machineId)}`;
  const tone =
    chip?.riskLevel === "CRITICAL"
      ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
      : chip?.riskLevel === "HIGH"
        ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
        : chip?.riskLevel === "MODERATE"
          ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-100"
          : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs hover:underline ${tone} ${className}`}
      title="Predicted health — advisory only"
    >
      {chip ? (
        <>
          <span className="font-semibold tabular-nums">{chip.healthScore}</span>
          <span>{chip.riskLevel}</span>
          <span className="opacity-70">Predictive</span>
        </>
      ) : (
        <span>Predictive health</span>
      )}
    </Link>
  );
}
