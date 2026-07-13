"use client";

import { MatrixCard } from "../../components/ui";
import type { TruckRestockLine } from "@/lib/warehouse";

export default function TruckInventoryCard({
  title,
  lines,
  emptyLabel = "None",
}: {
  title: string;
  lines: TruckRestockLine[];
  emptyLabel?: string;
}) {
  return (
    <MatrixCard>
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {lines.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-slate-300">
                <span className="font-medium text-slate-100">{l.partNumber}</span>{" "}
                — {l.description}
              </span>
              <span className="shrink-0 text-slate-400">
                {l.currentQty}/{l.recommendedQty}
                {l.missingQty > 0 ? (
                  <span className="ml-2 text-amber-300">−{l.missingQty}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </MatrixCard>
  );
}
