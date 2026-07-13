import type {
  CrmAsset,
  CrmContract,
  CrmCustomer,
  CrmReportType,
  CrmSearchHit,
  CrmWarranty,
  CustomerDashboardMetrics,
  SiteDashboardMetrics,
  WarrantyStatus,
} from "./types";

const DAY_MS = 86_400_000;

export function daysUntil(isoDate: string, from = new Date()): number {
  const end = new Date(isoDate);
  end.setHours(0, 0, 0, 0);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
}

export function calculateWarrantyStatus(
  endDate: string,
  from = new Date(),
  soonDays = 90,
): WarrantyStatus {
  const days = daysUntil(endDate, from);
  if (days < 0) return "EXPIRED";
  if (days <= soonDays) return "EXPIRING_SOON";
  return "ACTIVE";
}

export function refreshWarrantyStatuses(
  warranties: CrmWarranty[],
  from = new Date(),
): CrmWarranty[] {
  return warranties.map((w) => ({
    ...w,
    status: calculateWarrantyStatus(w.endDate, from),
  }));
}

export function calculateContractStatus(
  endDate: string,
  from = new Date(),
  soonDays = 90,
): CrmContract["status"] {
  const days = daysUntil(endDate, from);
  if (days < 0) return "EXPIRED";
  if (days <= soonDays) return "EXPIRING_SOON";
  return "ACTIVE";
}

export function contractsApproachingExpiration(
  contracts: CrmContract[],
  withinDays = 90,
  from = new Date(),
): CrmContract[] {
  return contracts.filter((c) => {
    if (c.status === "DRAFT") return false;
    const days = daysUntil(c.endDate, from);
    return days >= 0 && days <= withinDays;
  });
}

export function assetAgeYears(installDate: string | null, from = new Date()): number | null {
  if (!installDate) return null;
  const start = new Date(installDate);
  return Math.max(0, (from.getTime() - start.getTime()) / (365.25 * DAY_MS));
}

export function buildCustomerDashboard(input: {
  customer: CrmCustomer;
  sitesCount: number;
  assets: CrmAsset[];
  openWorkOrders: number;
  upcomingPMs: number;
  overduePMs: number;
  serviceCallsThisMonth: number;
  contractStatus: string;
  warranties: CrmWarranty[];
  recentActivity: Array<{ label: string; at: string }>;
}): CustomerDashboardMetrics {
  const activeAssets = input.assets.filter((a) => a.status === "ACTIVE" || a.status === "LOANER");
  const healthy = activeAssets.filter((a) => a.status === "ACTIVE").length;
  const fleetHealthPct =
    activeAssets.length === 0
      ? null
      : Math.round((healthy / activeAssets.length) * 1000) / 10;
  const monthlyCopyVolume = input.assets.reduce(
    (s, a) => s + (a.monthlyVolume ?? 0),
    0,
  );
  const warrantyExpiring = input.warranties.filter(
    (w) => w.status === "EXPIRING_SOON" || w.status === "EXPIRED",
  ).length;

  return {
    totalSites: input.sitesCount,
    totalPrinters: input.assets.length,
    fleetHealthPct,
    openWorkOrders: input.openWorkOrders,
    upcomingPMs: input.upcomingPMs,
    overduePMs: input.overduePMs,
    monthlyCopyVolume,
    serviceCallsThisMonth: input.serviceCallsThisMonth,
    contractStatus: input.contractStatus,
    warrantyExpiring,
    recentActivity: input.recentActivity,
  };
}

export function buildSiteDashboard(input: {
  assets: CrmAsset[];
  openWorkOrders: number;
  scheduledVisits: number;
  upcomingPMs: number;
  recentRepairs: number;
  partsConsumed: number;
  technicianAssigned: string;
}): SiteDashboardMetrics {
  const active = input.assets.filter((a) => a.status === "ACTIVE");
  const fleetHealthPct =
    input.assets.length === 0
      ? null
      : Math.round((active.length / input.assets.length) * 1000) / 10;
  return {
    printerCount: input.assets.length,
    fleetHealthPct,
    openWorkOrders: input.openWorkOrders,
    scheduledVisits: input.scheduledVisits,
    upcomingPMs: input.upcomingPMs,
    recentRepairs: input.recentRepairs,
    partsConsumed: input.partsConsumed,
    monthlyVolume: input.assets.reduce((s, a) => s + (a.monthlyVolume ?? 0), 0),
    technicianAssigned: input.technicianAssigned,
  };
}

export function searchCrm(input: {
  query: string;
  customers: CrmCustomer[];
  sites: Array<{ id: string; name: string; siteNumber: string; customerId: string; physicalAddress: string }>;
  assets: CrmAsset[];
  contacts: Array<{ id: string; name: string; customerId: string; email: string }>;
  contracts: CrmContract[];
  page?: number;
  pageSize?: number;
}): { hits: CrmSearchHit[]; total: number } {
  const q = input.query.trim().toLowerCase();
  if (!q) return { hits: [], total: 0 };

  const hits: CrmSearchHit[] = [];

  for (const c of input.customers) {
    if (
      c.name.toLowerCase().includes(q) ||
      c.customerNumber.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "CUSTOMER",
        id: c.id,
        label: c.name,
        subtitle: c.customerNumber,
        href: `/customers/${c.id}`,
      });
    }
  }
  for (const s of input.sites) {
    if (
      s.name.toLowerCase().includes(q) ||
      s.siteNumber.toLowerCase().includes(q) ||
      s.physicalAddress.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "SITE",
        id: s.id,
        label: s.name,
        subtitle: s.siteNumber,
        href: `/customers/${s.customerId}/sites/${s.id}`,
      });
    }
  }
  for (const a of input.assets) {
    if (
      a.assetNumber.toLowerCase().includes(q) ||
      a.serialNumber.toLowerCase().includes(q) ||
      a.model.toLowerCase().includes(q) ||
      a.ipAddress.toLowerCase().includes(q) ||
      a.hostname.toLowerCase().includes(q) ||
      a.barcode.toLowerCase().includes(q) ||
      a.qrLabel.toLowerCase().includes(q)
    ) {
      hits.push({
        kind: "ASSET",
        id: a.id,
        label: `${a.assetNumber} · ${a.nickname || a.model}`,
        subtitle: a.serialNumber,
        href: `/customers/${a.customerId}/assets/${a.id}`,
      });
    }
  }
  for (const c of input.contacts) {
    if (c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) {
      hits.push({
        kind: "CONTACT",
        id: c.id,
        label: c.name,
        subtitle: c.email,
        href: `/customers/${c.customerId}`,
      });
    }
  }
  for (const c of input.contracts) {
    if (c.contractNumber.toLowerCase().includes(q)) {
      hits.push({
        kind: "CONTRACT",
        id: c.id,
        label: c.contractNumber,
        subtitle: c.status,
        href: `/customers/${c.customerId}`,
      });
    }
  }

  const pageSize = input.pageSize ?? 25;
  const page = Math.max(1, input.page ?? 1);
  const start = (page - 1) * pageSize;
  return { hits: hits.slice(start, start + pageSize), total: hits.length };
}

export function generateCrmReport(
  type: CrmReportType,
  data: {
    customers: CrmCustomer[];
    assets: CrmAsset[];
    contracts: CrmContract[];
    warranties: CrmWarranty[];
  },
): { title: string; rows: Array<Record<string, string | number>> } {
  switch (type) {
    case "FLEET_HEALTH":
      return {
        title: "Fleet Health",
        rows: data.assets.map((a) => ({
          asset: a.assetNumber,
          model: a.model,
          status: a.status,
          monthlyVolume: a.monthlyVolume ?? 0,
        })),
      };
    case "CUSTOMER_INVENTORY":
      return {
        title: "Customer Inventory",
        rows: data.customers.map((c) => ({
          customer: c.name,
          number: c.customerNumber,
          status: c.status,
          printers: data.assets.filter((a) => a.customerId === c.id).length,
        })),
      };
    case "WARRANTY_EXPIRATION":
      return {
        title: "Warranty Expiration",
        rows: data.warranties.map((w) => ({
          assetId: w.assetId,
          kind: w.kind,
          status: w.status,
          endDate: w.endDate,
        })),
      };
    case "CONTRACT_EXPIRATION":
      return {
        title: "Contract Expiration",
        rows: data.contracts.map((c) => ({
          contract: c.contractNumber,
          customerId: c.customerId,
          endDate: c.endDate,
          status: c.status,
          daysRemaining: daysUntil(c.endDate),
        })),
      };
    case "ASSET_AGE":
      return {
        title: "Asset Age",
        rows: data.assets.map((a) => ({
          asset: a.assetNumber,
          installDate: a.installDate ?? "",
          ageYears: Math.round((assetAgeYears(a.installDate) ?? 0) * 10) / 10,
        })),
      };
    case "PM_COMPLIANCE":
      return {
        title: "PM Compliance",
        rows: data.assets.map((a) => ({
          asset: a.assetNumber,
          status: a.status,
          copyCount: a.currentCopyCount ?? 0,
        })),
      };
    case "SERVICE_HISTORY":
      return {
        title: "Service History",
        rows: data.assets.map((a) => ({
          asset: a.assetNumber,
          customerId: a.customerId,
          siteId: a.siteId,
        })),
      };
    case "PRINTER_UTILIZATION":
      return {
        title: "Printer Utilization",
        rows: data.assets
          .slice()
          .sort((a, b) => (b.monthlyVolume ?? 0) - (a.monthlyVolume ?? 0))
          .map((a) => ({
            asset: a.assetNumber,
            monthlyVolume: a.monthlyVolume ?? 0,
            copyCount: a.currentCopyCount ?? 0,
          })),
      };
    default:
      return { title: "Report", rows: [] };
  }
}

export function paginate<T>(items: T[], page = 1, pageSize = 25): {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
} {
  const p = Math.max(1, page);
  const start = (p - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page: p,
    pageSize,
  };
}

/** QR / barcode lookup — architecture for future camera scan. */
export function resolveAssetByCode(
  code: string,
  assets: CrmAsset[],
): CrmAsset | null {
  const q = code.trim().toLowerCase();
  return (
    assets.find(
      (a) =>
        a.qrLabel.toLowerCase() === q ||
        a.barcode.toLowerCase() === q ||
        a.assetNumber.toLowerCase() === q ||
        a.serialNumber.toLowerCase() === q,
    ) ?? null
  );
}
