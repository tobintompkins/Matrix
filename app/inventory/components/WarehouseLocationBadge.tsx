"use client";

export default function WarehouseLocationBadge({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  if (!code) {
    return <span className="text-slate-500">Unassigned</span>;
  }
  return (
    <code
      className={`rounded bg-slate-800/80 px-2 py-0.5 font-mono text-xs text-cyan-300 ${className}`}
      title={code}
    >
      {code}
    </code>
  );
}
