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
  IconAlert,
  IconBell,
  IconBrain,
  IconCalls,
  IconChevronLeft,
  IconClock,
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
  IconMeter,
  IconParts,
  IconPortal,
  IconPrinter,
  IconScanner,
  IconSettings,
  IconShield,
  IconTickets,
  IconTwin,
  IconUser,
  IconWorkOrders,
} from "./nav-icons";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  label: string;
  href: string;
  icon: IconComp;
  /** When true, only exact path matches count as active (avoids /admin lighting up for /admin/users). */
  exact?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: IconComp;
  defaultOpen?: boolean;
  description?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "service-operations",
    label: "Service Operations",
    description: "Calls, dispatch, jobs & field work",
    icon: IconDashboard,
    defaultOpen: true,
    items: [
      { label: "Service Hub", href: "/dashboard", icon: IconDashboard },
      { label: "Notifications", href: "/notifications", icon: IconBell },
      { label: "Service Calls", href: "/service-calls", icon: IconCalls },
      { label: "Dispatch Board", href: "/dispatch", icon: IconDispatch },
      { label: "Job Wizard", href: "/start-pm", icon: IconWorkOrders },
      { label: "PM Schedule", href: "/maintenance/schedule", icon: IconClock },
      { label: "Work Orders", href: "/work-orders", icon: IconWorkOrders },
      { label: "Field", href: "/field", icon: IconField },
      { label: "Service Tickets", href: "/tickets", icon: IconTickets },
      {
        label: "Customer Portal",
        href: "/portal/dashboard",
        icon: IconPortal,
      },
    ],
  },
  {
    id: "machines",
    label: "Machines",
    description: "Equipment, readings & maintenance",
    icon: IconPrinter,
    items: [
      { label: "Machine Database", href: "/fleet", icon: IconFleet },
      { label: "Digital Twin", href: "/digital-twin", icon: IconTwin },
      {
        label: "Preventive Maintenance",
        href: "/maintenance",
        icon: IconMaintenance,
        exact: true,
      },
      { label: "Meter Readings", href: "/maintenance/counts", icon: IconMeter },
      {
        label: "Machine History",
        href: "/maintenance/history",
        icon: IconClock,
      },
    ],
  },
  {
    id: "parts-inventory",
    label: "Parts & Inventory",
    description: "Stock, requests & ordering",
    icon: IconInventory,
    items: [
      { label: "Parts Inventory", href: "/inventory", icon: IconInventory, exact: true },
      {
        label: "Parts Requests",
        href: "/inventory/purchase-requests",
        icon: IconParts,
      },
      { label: "PM Kits", href: "/request-pm-kit", icon: IconMaintenance },
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
    id: "customers",
    label: "Customers",
    description: "Contacts, sites & equipment",
    icon: IconCustomers,
    items: [
      { label: "Customers", href: "/customers", icon: IconCustomers },
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Reports & business performance",
    icon: IconDashboard,
    items: [
      { label: "Reports", href: "/admin/reports", icon: IconLibrary },
      {
        label: "Executive Dashboard",
        href: "/executive-command-center",
        icon: IconDashboard,
        exact: true,
      },
      {
        label: "Predictive Maintenance",
        href: "/ai-operations/predictive-maintenance",
        icon: IconMaintenance,
      },
      {
        label: "AI Insights",
        href: "/executive-command-center/ai-insights",
        icon: IconBrain,
      },
    ],
  },
  {
    id: "matrix-ai",
    label: "Matrix AI",
    description: "Troubleshooting & recommendations",
    icon: IconAi,
    items: [
      { label: "AI Technician", href: "/ai-technician", icon: IconAi },
      {
        label: "AI Operations Center",
        href: "/ai-operations",
        icon: IconBrain,
        exact: true,
      },
      {
        label: "Decision Engine",
        href: "/ai-operations/decisions",
        icon: IconWorkOrders,
      },
      {
        label: "Automation Center",
        href: "/ai-operations/automations",
        icon: IconSettings,
      },
      { label: "Knowledge Base", href: "/knowledge-base", icon: IconKnowledge },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    description: "People, settings & system tools",
    icon: IconShield,
    items: [
      { label: "Admin Home", href: "/admin", icon: IconShield, exact: true },
      { label: "Users", href: "/admin/users", icon: IconUser },
      { label: "Roles", href: "/admin/roles", icon: IconShield },
      {
        label: "Organization Settings",
        href: "/admin/organization",
        icon: IconSettings,
      },
      {
        label: "System Health",
        href: "/admin/system-health",
        icon: IconAlert,
      },
      {
        label: "Data Quality",
        href: "/admin/data-quality",
        icon: IconLibrary,
      },
      { label: "System Logs", href: "/admin/system-logs", icon: IconTickets },
      {
        label: "Role Simulator",
        href: "/admin/role-simulator",
        icon: IconUser,
      },
    ],
  },
];

const COLLAPSE_KEY = "matrix.sidebar.collapsed";
const COLLAPSE_EVENT = "matrix-sidebar-collapse";
const GROUP_OPEN_KEY = "matrix.sidebar.groups.open";
const GROUP_OPEN_EVENT = "matrix-sidebar-groups";

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

function readGroupOpenMap(): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  try {
    const raw = localStorage.getItem(GROUP_OPEN_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed;
  } catch {
    return defaults;
  }
}

function subscribeGroupOpen(onStoreChange: () => void) {
  window.addEventListener(GROUP_OPEN_EVENT, onStoreChange);
  return () => window.removeEventListener(GROUP_OPEN_EVENT, onStoreChange);
}

function getGroupOpenSnapshot() {
  return JSON.stringify(readGroupOpenMap());
}

function getGroupOpenServerSnapshot() {
  return JSON.stringify({});
}

function setExclusiveGroupOpen(
  groupId: string,
  open: boolean,
  groupIds: string[],
) {
  const next: Record<string, boolean> = {};
  for (const id of groupIds) {
    next[id] = id === groupId ? open : false;
  }
  try {
    localStorage.setItem(GROUP_OPEN_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(GROUP_OPEN_EVENT));
}

function isNavActive(href: string, activePath: string, exact?: boolean): boolean {
  if (activePath === href) return true;
  if (exact) return false;
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
  const groupOpenJson = useSyncExternalStore(
    subscribeGroupOpen,
    getGroupOpenSnapshot,
    getGroupOpenServerSnapshot,
  );
  const groupOpen = useMemo(
    () => JSON.parse(groupOpenJson) as Record<string, boolean>,
    [groupOpenJson],
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");

  const persistCollapsed = useCallback((value: boolean) => {
    setSidebarCollapsed(value);
  }, []);

  const groups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(role, item.href)),
    })).filter((group) => group.items.length > 0);
  }, [role]);

  const searchQuery = menuSearch.trim().toLowerCase();
  const groupIds = groups.map((group) => group.id);
  const hasStoredGroupPreference = Object.keys(groupOpen).length > 0;
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      `${group.label} ${group.description ?? ""} ${item.label}`
        .toLowerCase()
        .includes(searchQuery),
    ),
  })).filter((group) => group.items.length > 0);

  const renderMenuSearch = (id: string) => (
    <div className="space-y-2 border-b border-slate-800 px-3 py-3">
      <label htmlFor={id} className="block text-xs font-medium text-slate-300">
        Find a page
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          type="search"
          value={menuSearch}
          onChange={(event) => setMenuSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenuSearch("");
          }}
          placeholder="Try dispatch, parts, reports"
          className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-cyan-400"
        />
        {menuSearch && (
          <button type="button" onClick={() => setMenuSearch("")}
            className="rounded-lg px-2 text-xs text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-400">
            Clear
          </button>
        )}
      </div>
      {searchQuery && (
        <p role="status" className="text-xs text-slate-300">
          {visibleGroups.reduce((count, group) => count + group.items.length, 0)} matching pages
          {visibleGroups.length === 0 ? ". Try a different word or clear the search." : ""}
        </p>
      )}
    </div>
  );

  const renderNavGroups = (opts: {
    collapsedMode: boolean;
    onNavigate?: () => void;
  }) =>
    visibleGroups.map((group) => {
      const GroupIcon = group.icon;
      const isActiveGroup = group.items.some((item) =>
        isNavActive(item.href, activePath, item.exact),
      );
      const open =
        Boolean(searchQuery) ||
        opts.collapsedMode ||
        (hasStoredGroupPreference
          ? groupOpen[group.id] === true
          : isActiveGroup);

      return (
        <div key={group.id} className="space-y-1">
          {!opts.collapsedMode && (
            <button
              type="button"
              onClick={() => setExclusiveGroupOpen(group.id, !open, groupIds)}
              disabled={Boolean(searchQuery)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-slate-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              aria-expanded={open}
            >
              <GroupIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-200">{group.label}</span>
                {open && group.description ? (
                  <span className="mt-0.5 block text-xs font-normal leading-relaxed text-slate-400">
                    {group.description}
                  </span>
                ) : null}
              </span>
              <IconChevronLeft
                className={`h-3 w-3 text-slate-600 transition-transform ${
                  open ? "-rotate-90" : "rotate-180"
                }`}
              />
            </button>
          )}
          {opts.collapsedMode && (
            <p className="sr-only">{group.label}</p>
          )}
          {open && (
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(item.href, activePath, item.exact);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={opts.collapsedMode ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      onClick={opts.onNavigate}
                      className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                        opts.collapsedMode ? "justify-center" : "pl-3"
                      } ${
                        active
                          ? "bg-cyan-500/15 font-semibold text-cyan-300 ring-1 ring-cyan-500/40"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          active
                            ? "text-cyan-300"
                            : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      />
                      {!opts.collapsedMode && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {opts.collapsedMode && (
                        <span className="sr-only">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    });

  const sidebar = (
    <aside
      className={`matrix-sidebar flex h-full flex-col border-r border-slate-800/90 bg-[color:var(--matrix-surface)] transition-[width] duration-200 ${
        collapsed ? "w-[4.5rem]" : "w-72"
      }`}
    >
      <div
        className={`flex items-center border-b border-slate-800/90 ${
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
          onClick={() => { setMenuSearch(""); persistCollapsed(!collapsed); }}
          className="hidden rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconChevronLeft
            className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {!collapsed && renderMenuSearch("matrix-menu-search-desktop")}
      <nav
        className="flex-1 space-y-4 overflow-y-auto px-2 py-4"
        aria-label="Primary"
      >
        {renderNavGroups({ collapsedMode: collapsed })}
      </nav>
    </aside>
  );

  return (
    <div className="matrix-workspace min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <a href="#matrix-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-cyan-300 focus:px-4 focus:py-3 focus:text-slate-950">
        Skip to page content
      </a>
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
              <div className="flex h-full flex-col bg-[color:var(--matrix-surface)]">
                <div className="flex items-center justify-between border-b border-slate-800/90 px-4 py-4">
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
                {renderMenuSearch("matrix-menu-search-mobile")}
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <nav
                    className="space-y-4 px-2 py-4"
                    aria-label="Primary mobile"
                  >
                    {renderNavGroups({
                      collapsedMode: false,
                      onNavigate: () => setMobileOpen(false),
                    })}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="matrix-topbar sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/85 px-4 backdrop-blur md:px-6">
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
                  Matrix workspace
                </p>
                <h1 className="truncate text-base font-semibold text-white md:text-lg">
                  {title}
                </h1>
              </div>
            </div>
            <MatrixAuthControls />
          </header>

          <main id="matrix-main" tabIndex={-1} className="matrix-content mx-auto w-full max-w-[1600px] flex-1 px-[var(--matrix-content-pad-mobile)] py-4 md:px-[var(--matrix-content-pad)] md:py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
