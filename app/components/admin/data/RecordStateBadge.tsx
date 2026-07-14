"use client";

import type { AdminRecordStateLabel } from "@/lib/admin/data/types";

const STYLES: Record<AdminRecordStateLabel, string> = {
  Active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  Archived: "border-slate-500/40 bg-slate-500/10 text-slate-300",
  Deleted: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  Protected: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  Completed: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  Locked: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  "Requires Review": "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
  Invalid: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  Retired: "border-violet-500/40 bg-violet-500/10 text-violet-200",
};

export default function RecordStateBadge({
  label,
}: {
  label: AdminRecordStateLabel;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STYLES[label]}`}
    >
      {label}
    </span>
  );
}

export function lifecycleToBadge(
  lifecycle: string | undefined | null,
  extras?: { completed?: boolean; retired?: boolean; invalid?: boolean },
): AdminRecordStateLabel {
  if (extras?.invalid) return "Invalid";
  if (lifecycle === "DELETED") return "Deleted";
  if (lifecycle === "ARCHIVED") return "Archived";
  if (extras?.retired) return "Retired";
  if (extras?.completed) return "Completed";
  return "Active";
}
