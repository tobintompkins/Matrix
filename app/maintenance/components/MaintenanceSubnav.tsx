"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../components/ui";

const LINKS = [
  { href: "/maintenance", label: "PM Dashboard", exact: true },
  { href: "/maintenance/counts", label: "Meter Counts" },
  { href: "/maintenance/schedule", label: "PM Schedule" },
  { href: "/maintenance/cleanings", label: "Cleanings" },
  { href: "/maintenance/history", label: "History" },
  { href: "/maintenance/forecasting", label: "Forecasting" },
  { href: "/maintenance/reports", label: "Reports" },
  { href: "/maintenance/settings", label: "Settings" },
  { href: "/maintenance/executive", label: "Executive" },
];

export default function MaintenanceSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Preventive maintenance sections"
      className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3"
    >
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
