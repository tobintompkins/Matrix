"use client";

type Point = { label: string; value: number };

export default function TrendBars({
  title,
  data,
  emptyMessage = "No trend data for this range.",
}: {
  title: string;
  data: Point[];
  emptyMessage?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      {data.length === 0 || data.every((d) => d.value === 0) ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((d) => (
            <li key={d.label}>
              <div className="mb-1 flex justify-between text-xs text-slate-400">
                <span>{d.label}</span>
                <span>{d.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800">
                <div
                  className="h-2 rounded-full bg-cyan-500"
                  style={{ width: `${(d.value / max) * 100}%` }}
                  role="img"
                  aria-label={`${d.label}: ${d.value}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
