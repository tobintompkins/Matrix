"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  connectivityLabel,
  getConnectivityService,
  type ConnectivityStatus,
} from "@/lib/field";
import FieldServiceWorkerRegister from "./FieldServiceWorkerRegister";

const fieldNav = [
  { label: "Today", href: "/field", match: (p: string) => p === "/field" },
  {
    label: "Assigned Work",
    href: "/field/work",
    match: (p: string) => p.startsWith("/field/work"),
  },
  {
    label: "Printers",
    href: "/field/printers",
    match: (p: string) => p.startsWith("/field/printers"),
  },
  {
    label: "Parts",
    href: "/field/parts",
    match: (p: string) => p.startsWith("/field/parts"),
  },
  {
    label: "Offline Queue",
    href: "/field/offline",
    match: (p: string) => p.startsWith("/field/offline"),
  },
  {
    label: "Profile",
    href: "/field/profile",
    match: (p: string) =>
      p.startsWith("/field/profile") || p.startsWith("/field/settings"),
  },
];

function statusClasses(status: ConnectivityStatus): string {
  switch (status) {
    case "ONLINE":
      return "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40";
    case "OFFLINE":
      return "bg-rose-500/20 text-rose-300 ring-rose-500/40";
    case "UNSTABLE":
      return "bg-amber-500/20 text-amber-300 ring-amber-500/40";
    case "SYNCHRONIZING":
      return "bg-cyan-500/20 text-cyan-300 ring-cyan-500/40";
    case "SYNC_FAILED":
      return "bg-rose-500/20 text-rose-300 ring-rose-500/40";
  }
}

export default function FieldShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [status, setStatus] = useState<ConnectivityStatus>("ONLINE");

  useEffect(() => {
    const svc = getConnectivityService();
    svc.startPolling(30_000);
    return svc.subscribe(setStatus);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-400">
              Matrix Field
            </p>
            <h1 className="text-lg font-bold sm:text-xl">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClasses(status)}`}
              role="status"
              aria-live="polite"
              aria-label={`Connectivity: ${connectivityLabel(status)}`}
            >
              <span
                className="h-2 w-2 rounded-full bg-current"
                aria-hidden
              />
              {connectivityLabel(status)}
            </span>
            <Link
              href="/dashboard"
              className="min-h-11 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-cyan-500 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              Desktop
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 pb-28">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-900/95 backdrop-blur"
        aria-label="Field primary"
      >
        <ul className="mx-auto grid max-w-3xl grid-cols-3 gap-1 px-2 py-2 sm:grid-cols-6">
          {fieldNav.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-12 flex-col items-center justify-center rounded-lg px-1 text-center text-[11px] font-semibold leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                    active
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <FieldServiceWorkerRegister />
    </div>
  );
}
