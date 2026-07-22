"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/ai-operations/predictive-maintenance", label: "Overview" },
  { href: "/ai-operations/predictive-maintenance/machines", label: "Machines" },
  { href: "/ai-operations/predictive-maintenance/forecast", label: "Forecast" },
  { href: "/ai-operations/predictive-maintenance/alerts", label: "Alerts" },
  { href: "/ai-operations/predictive-maintenance/history", label: "History" },
  {
    href: "/ai-operations/predictive-maintenance/data-readiness",
    label: "Data readiness",
  },
  { href: "/ai-operations/predictive-maintenance/settings", label: "Settings" },
];

export default function PredictiveNav() {
  const pathname = usePathname();
  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-slate-800 pb-3"
      aria-label="Predictive maintenance"
    >
      {LINKS.map((link) => {
        const active =
          pathname === link.href ||
          (link.href !== "/ai-operations/predictive-maintenance" &&
            pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/ai-operations"
        className="ml-auto rounded-lg px-3 py-2 text-sm text-slate-500 hover:text-cyan-300"
      >
        AI Operations
      </Link>
    </nav>
  );
}
