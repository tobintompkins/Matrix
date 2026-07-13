"use client";

import { MatrixCard } from "../../components/ui";
import type { PmPartsKit } from "@/lib/pm-intelligence";

export default function PMPartsKitCard({
  kit,
  availability,
}: {
  kit: PmPartsKit;
  availability?: string;
}) {
  return (
    <MatrixCard>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-100">{kit.name}</h3>
          <p className="text-sm text-slate-400">
            {kit.printerModel} · ~{kit.estimatedLaborHours}h labor
          </p>
        </div>
        {availability ? (
          <span className="text-xs text-cyan-300">{availability}</span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-slate-500">Required</p>
        <ul className="text-slate-300">
          {kit.requiredParts.map((p) => (
            <li key={p.partNumber}>
              {p.partNumber} × {p.quantity} — {p.description}
            </li>
          ))}
        </ul>
      </div>
    </MatrixCard>
  );
}
