"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import { useUser } from "@clerk/nextjs";
import { canAccessRoute, resolveMatrixRole } from "@/lib/auth/permissions";
import MatrixAuthControls from "./MatrixAuthControls";
import {
  IconAi,
  IconBell,
  IconBrain,
  IconCalls,
  IconChevronLeft,
  IconCustomers,
  IconDashboard,
  IconDiagram,
  IconDispatch,
  IconField,
  IconFleet,
  IconInventory,
  IconKnowledge,
  IconLibrary,
  IconMaintenance,
  IconMenu,
  IconParts,
  IconPortal,
  IconScanner,
  IconShield,
  IconTickets,
  IconTwin,
  IconWorkOrders,
} from "./nav-icons";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  label: string;
  href: string;
  icon: IconComp;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Service Hub", href: "/dashboard", icon: IconDashboard },
      { label: "Notifications", href: "/notifications", icon: IconBell },
    ],
  },
  {
    label: "Service Ops",
    items: [
      { label: "Service Calls", href: "/service-calls", icon: IconCalls },
      { label: "Dispatch", href: "/dispatch", icon: IconDispatch },
      { label: "Work Orders", href: "/work-orders", icon: IconWorkOrders },
      { label: "Field", href: "/field", icon: IconField },
      { label: "Service Tickets", href: "/tickets", icon: IconTickets },
    ],
  },
  {
    label: "Fleet & Maintenance",
    items: [
      {
        label: "Preventive Maintenance",
        href: "/maintenance",
        icon: IconMaintenance,
      },
      { label: "Fleet", href: "/fleet", icon: IconFleet },
      { label: "Digital Twin", href: "/digital-twin", icon: IconTwin },
    ],
  },
  {
    label: "Customers",
    items: [
      { label: "Customers", href: "/customers", icon: IconCustomers },
      {
        label: "Customer Portal",
        href: "/portal/dashboard",
        icon: IconPortal,
      },
    ],
  },
  {
    label: "Parts & Inventory",
    items: [
      { label: "Inventory", href: "/inventory", icon: IconInventory },
      { label: "Scanner / Lookup", href: "/scanner", icon: IconScanner },
      {
        label: "Parts Order Builder",
        href: "/parts-order-builder",
        icon: IconParts,
      },
      {
        label: "Guided Diagram Ordering",
        href: "/guided-diagram-ordering",
        icon: IconDiagram,
      },
      {
        label: "Order Form Preview",
        href: "/parts-order-preview",
        icon: IconParts,
      },
      { label: "Diagram Library", href: "/diagram-library", icon: IconLibrary },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { label: "Knowledge Base", href: "/knowledge-base", icon: IconKnowledge },
      { label: "Matrix Assist", href: "/ai-technician", icon: IconAi },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Administration", href: "/admin", icon: IconShield },
      {
        label: "Executive Command Center",
        href: "/executive-command-center",
        icon: IconDashboard,
      },
      {
        label: "AI Operations Center",
        href: "/ai-operations",
        icon: IconBrain,
      },
      {
        label: "Predictive Maintenance",
        href: "/ai-operations/predictive-maintenance",
        icon: IconMaintenance,
      },
    ],
  },
];

const COLLAPSE_KEY = "matrix.sidebar.collapsed";
const COLLAPSE_EVENT = "matrix-sidebar-collapse";

function subscribeCollapse(onStoreChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onStoreChange);
  return () => window.removeEventListener(COLLAPSE_EVENT, onStoreChange);
}

function getCollapseSnapshot() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function getCollapseServerSnapshot() {
  return false;
}

function setSidebarCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function isNavActive(href: string, activePath: string): boolean {
  if (activePath === href) return true;
  if (href !== "/" && activePath.startsWith(`${href}/`)) return true;
  if (href === "/portal/dashboard" && activePath.startsWith("/portal")) {
    return true;
  }
  return false;
}

type MatrixShellProps = {
  title: string;
  activePath: string;
  children: ReactNode;
};

export default function MatrixShell({
  title,
  activePath,
  children,
}: MatrixShellProps) {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );

  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    getCollapseSnapshot,
    getCollapseServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const persistCollapsed = useCallback((value: boolean) => {
    setSidebarCollapsed(value);
  }, []);

  const groups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(role, item.href)),
    })).filter((group) => group.items.length > 0);
  }, [role]);

  const sidebar = (
    <aside
      className={`flex h-full flex-col border-r border-slate-800 bg-slate-900 transition-[width] duration-200 ${
        collapsed ? "w-[4.5rem]" : "w-64"
      }`}
    >
      <div
        className={`flex items-center border-b border-slate-800 ${
          collapsed ? "justify-center px-2 py-4" : "justify-between px-4 py-4"
        }`}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-[0.2em] text-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            MATRIX
          </Link>
        )}
        <button
          type="button"
          onClick={() => persistCollapsed(!collapsed)}
          className="hidden rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconChevronLeft
            className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <nav
        className="flex-1 space-y-5 overflow-y-auto px-2 py-4"
        aria-label="Primary"
      >
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(item.href, activePath);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                        collapsed ? "justify-center" : ""
                      } ${
                        active
                          ? "bg-cyan-500/15 font-semibold text-cyan-300 ring-1 ring-cyan-500/40"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active
                            ? "text-cyan-300"
                            : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {collapsed && <span className="sr-only">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
          {sidebar}
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/70"
              aria-label="Close navigation"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative h-full w-72 shadow-xl shadow-black/40">
              <div className="flex h-full flex-col bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
                  <span className="text-lg font-bold tracking-[0.2em] text-cyan-400">
                    MATRIX
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                  >
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <nav
                    className="space-y-5 px-2 py-4"
                    aria-label="Primary mobile"
                  >
                    {groups.map((group) => (
                      <div key={group.label}>
                        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {group.label}
                        </p>
                        <ul className="space-y-0.5">
                          {group.items.map((item) => {
                            const active = isNavActive(item.href, activePath);
                            const Icon = item.icon;
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  aria-current={active ? "page" : undefined}
                                  onClick={() => setMobileOpen(false)}
                                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                                    active
                                      ? "bg-cyan-500/15 font-semibold text-cyan-300 ring-1 ring-cyan-500/40"
                                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                                  }`}
                                >
                                  <Icon className="h-4 w-4 shrink-0" />
                                  <span>{item.label}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/90 px-4 backdrop-blur md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 lg:hidden"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
              >
                <IconMenu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-500/90">
                  Service Platform
                </p>
                <h1 className="truncate text-base font-semibold text-white md:text-lg">
                  {title}
                </h1>
              </div>
            </div>
            <MatrixAuthControls />
          </header>

          <main className="flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
