import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  const { className, ...rest } = props;
  return {
    className: className ?? "h-4 w-4 shrink-0",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...rest,
  };
}

export function IconDashboard(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

export function IconFleet(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M8 18v2M16 18v2M4 12h16" />
    </svg>
  );
}

export function IconTwin(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}

export function IconMaintenance(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5z" />
    </svg>
  );
}

export function IconBell(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconCustomers(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconPortal(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 10h18M8 14h3" />
    </svg>
  );
}

export function IconCalls(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export function IconDispatch(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16M15 4v16" />
    </svg>
  );
}

export function IconWorkOrders(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

export function IconField(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconTickets(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V9z" />
      <path d="M12 8v8" />
    </svg>
  );
}

export function IconInventory(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M21 8 12 3 3 8l9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function IconScanner(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 7V5a1 1 0 0 1 1-1h2M16 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M8 20H6a1 1 0 0 1-1-1v-2" />
      <path d="M7 12h10" />
    </svg>
  );
}

export function IconParts(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </svg>
  );
}

export function IconDiagram(p: IconProps) {
  return (
    <svg {...base(p)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="8" y="14" width="7" height="7" rx="1" />
      <path d="M10 6.5h4M11.5 10v4" />
    </svg>
  );
}

export function IconLibrary(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function IconKnowledge(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M10 8h6M10 12h4" />
    </svg>
  );
}

export function IconAi(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z" />
      <circle cx="10" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Patch 51A.1 — AI Operations Center (Brain) */
export function IconBrain(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9.5 4.5a3 3 0 0 0-3 3v.4A3 3 0 0 0 4 10.5c0 1.1.6 2.1 1.5 2.6V16a3 3 0 0 0 3 3h1" />
      <path d="M14.5 4.5a3 3 0 0 1 3 3v.4A3 3 0 0 1 20 10.5c0 1.1-.6 2.1-1.5 2.6V16a3 3 0 0 1-3 3h-1" />
      <path d="M12 4v16" />
      <path d="M9 9h1.5M13.5 9H15M9 12h1.5M13.5 12H15M9.5 15H11M13 15h1.5" />
    </svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconMenu(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function IconSignOut(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMeter(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 20V10M18 20V4M6 20v-4" />
    </svg>
  );
}

export function IconCleaning(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 21h18M5 21V10l7-7 7 7v11" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function IconPrinter(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
    </svg>
  );
}
