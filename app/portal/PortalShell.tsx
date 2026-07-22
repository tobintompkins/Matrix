"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { getActiveMembership, getSupportContact } from "@/lib/portal";

const portalNav: Array<{
  label: string;
  href: string;
  adminOnly?: boolean;
}> = [
  { label: "Dashboard", href: "/portal/dashboard" },
  { label: "Service Requests", href: "/portal/service" },
  { label: "Equipment", href: "/portal/equipment" },
  { label: "Preventive Maintenance", href: "/portal/preventive-maintenance" },
  { label: "Meter Readings", href: "/portal/meters" },
  { label: "Parts Requests", href: "/portal/parts" },
  { label: "Documents", href: "/portal/documents" },
  { label: "Contacts", href: "/portal/contacts" },
  { label: "Notifications", href: "/portal/notifications" },
  { label: "Profile", href: "/portal/profile" },
  { label: "Portal Users", href: "/portal/users", adminOnly: true },
  { label: "Locations", href: "/portal/locations", adminOnly: true },
];

export default function PortalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const membership = getActiveMembership();
  const support = getSupportContact();
  const isAdmin = membership?.role === "CUSTOMER_ADMIN";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-400">
              Matrix Customer Portal
            </p>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            {membership ? (
              <p className="text-xs text-slate-400">
                {membership.displayName} ·{" "}
                {membership.role.replaceAll("_", " ")}
              </p>
            ) : (
              <p className="text-xs text-rose-300">No active membership</p>
            )}
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>{support.teamName}</p>
            <a
              className="text-cyan-300 hover:text-cyan-200"
              href={`tel:${support.phone}`}
            >
              {support.phone}
            </a>
            <p className="mt-1">
              <Link
                href="/portal/onboarding"
                className="text-cyan-300 hover:text-cyan-200"
              >
                Onboarding
              </Link>
            </p>
          </div>
        </div>
        <nav
          className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3"
          aria-label="Customer portal"
        >
          {portalNav
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                    active
                      ? "bg-cyan-500/20 text-cyan-200"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
