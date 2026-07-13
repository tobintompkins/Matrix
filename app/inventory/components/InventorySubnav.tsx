"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../components/ui";

const LINKS = [
  { href: "/inventory", label: "Hub", exact: true },
  { href: "/inventory/warehouses", label: "Warehouses" },
  { href: "/inventory/receiving", label: "Receiving" },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/truck-restock", label: "Truck Restock" },
  { href: "/inventory/cycle-count", label: "Cycle Count" },
  { href: "/inventory/analytics", label: "Analytics" },
  { href: "/inventory/truck", label: "Truck Stock" },
  { href: "/inventory/purchase-requests", label: "Purchase Requests" },
  { href: "/inventory/vendors", label: "Vendors" },
];

export default function InventorySubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Inventory sections"
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
