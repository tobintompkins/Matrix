"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { EXECUTIVE_RANGE_OPTIONS } from "@/lib/executive-command-center/date-range";

const LINKS = [
  { href: "/executive-command-center", label: "Overview" },
  { href: "/executive-command-center/analytics", label: "KPI Dashboard" },
  { href: "/executive-command-center/briefings", label: "Briefings" },
  { href: "/executive-command-center/report-center", label: "Report Builder" },
  { href: "/executive-command-center/alerts", label: "Alerts & Actions" },
  { href: "/executive-command-center/schedules", label: "Schedules" },
  { href: "/executive-command-center/scorecards", label: "Scorecards" },
  { href: "/executive-command-center/comparisons", label: "Comparisons" },
  { href: "/executive-command-center/ai-insights", label: "AI Copilot" },
  { href: "/executive-command-center/trends", label: "KPI Trends" },
  { href: "/executive-command-center/technicians", label: "Tech Productivity" },
  { href: "/executive-command-center/customers", label: "Customer Reliability" },
  { href: "/executive-command-center/predictive", label: "Predictive Trends" },
  {
    href: "/executive-command-center/predictive-analytics",
    label: "Business Forecasts",
  },
  { href: "/executive-command-center/insights", label: "Insight Feed" },
  { href: "/executive-command-center/widgets", label: "Widgets" },
];

type Props = {
  range: string;
  onRangeChange?: (range: string) => void;
};

export default function ExecutiveNav({ range, onRangeChange }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRange = range || searchParams.get("range") || "LAST_30";

  return (
    <div className="mb-4 space-y-3">
      <nav
        className="flex flex-wrap gap-2"
        aria-label="Executive Intelligence sections"
      >
        {LINKS.map((link) => {
          const active =
            link.href === "/executive-command-center"
              ? pathname === link.href
              : pathname.startsWith(link.href);
          const href = `${link.href}?range=${encodeURIComponent(currentRange)}`;
          return (
            <Link
              key={link.href}
              href={href}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                active
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                  : "border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <label className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <span>Date range</span>
        <select
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-slate-200"
          value={currentRange}
          onChange={(e) => onRangeChange?.(e.target.value)}
          aria-label="Analytics date range"
        >
          {EXECUTIVE_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
