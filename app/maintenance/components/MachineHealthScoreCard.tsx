"use client";

import { MatrixCard } from "../../components/ui";
import type { MachineHealthScore } from "@/lib/pm-intelligence";

export default function MachineHealthScoreCard({
  health,
}: {
  health: MachineHealthScore;
}) {
  return (
    <MatrixCard>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Machine health score
      </p>
      <p className="mt-2 text-4xl font-bold text-slate-100">
        {health.score}
        <span className="ml-2 text-lg font-semibold text-cyan-300">
          — {health.label}
        </span>
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {health.factors.map((f) => (
          <li key={f.key} className="flex justify-between gap-2 text-slate-300">
            <span>
              {f.label}: {f.detail}
            </span>
            <span className={f.impact < 0 ? "text-amber-300" : "text-slate-500"}>
              {f.impact}
            </span>
          </li>
        ))}
      </ul>
    </MatrixCard>
  );
}
