"use client";

import type { RelationshipImpact } from "@/lib/admin/data/types";

export default function RelationshipImpactViewer({
  impact,
  loading = false,
}: {
  impact: RelationshipImpact | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <p className="text-sm text-slate-400" role="status">
        Reviewing related records…
      </p>
    );
  }
  if (!impact) return null;

  return (
    <section
      aria-label="Relationship impact"
      className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
    >
      <h3 className="text-sm font-semibold text-white">Affected Relationships</h3>
      <ul className="mt-3 space-y-2">
        {impact.items.map((item) => (
          <li
            key={item.category}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <span className="text-slate-300">
              {item.category}
              {item.blocking ? (
                <span className="ml-2 text-xs text-amber-300">(blocking)</span>
              ) : null}
              {item.detail ? (
                <span className="mt-0.5 block text-xs text-slate-500">
                  {item.detail}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 font-medium text-slate-200">
              {item.count}
            </span>
          </li>
        ))}
        {impact.items.length === 0 ? (
          <li className="text-sm text-slate-500">No related records found.</li>
        ) : null}
      </ul>
      {impact.blockers.length > 0 ? (
        <div className="mt-3 space-y-1" role="alert">
          {impact.blockers.map((b) => (
            <p key={b} className="text-sm text-amber-200">
              {b}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
