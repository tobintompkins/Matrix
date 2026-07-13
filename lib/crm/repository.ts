import {
  buildCustomerDashboard,
  buildSiteDashboard,
  calculateContractStatus,
  contractsApproachingExpiration,
  generateCrmReport,
  paginate,
  refreshWarrantyStatuses,
  resolveAssetByCode,
  searchCrm,
} from "./calculations";
import {
  CRM_ASSETS,
  CRM_CONTACTS,
  CRM_CONTRACTS,
  CRM_CUSTOMERS,
  CRM_DOCUMENTS,
  CRM_LIFECYCLE,
  CRM_RELATIONSHIPS,
  CRM_SITES,
  CRM_WARRANTIES,
} from "./seed";
import type {
  CrmAsset,
  CrmAuditEntry,
  CrmContact,
  CrmContract,
  CrmCustomer,
  CrmDocument,
  CrmReportType,
  CrmSite,
  CrmWarranty,
  LifecycleEvent,
  AssetRelationship,
} from "./types";

const STORAGE_KEY = "matrix.crm.v1";

type Store = {
  customers: CrmCustomer[];
  contacts: CrmContact[];
  sites: CrmSite[];
  assets: CrmAsset[];
  relationships: AssetRelationship[];
  lifecycle: LifecycleEvent[];
  contracts: CrmContract[];
  warranties: CrmWarranty[];
  documents: CrmDocument[];
  audit: CrmAuditEntry[];
};

/** In-memory fallback for Node tests / SSR (sessionStorage unavailable). */
let memoryStore: Store | null = null;

function seedStore(): Store {
  return {
    customers: structuredClone(CRM_CUSTOMERS),
    contacts: structuredClone(CRM_CONTACTS),
    sites: structuredClone(CRM_SITES),
    assets: structuredClone(CRM_ASSETS),
    relationships: structuredClone(CRM_RELATIONSHIPS),
    lifecycle: structuredClone(CRM_LIFECYCLE),
    contracts: structuredClone(CRM_CONTRACTS).map((c) => ({
      ...c,
      status: calculateContractStatus(c.endDate),
    })),
    warranties: refreshWarrantyStatuses(structuredClone(CRM_WARRANTIES)),
    documents: structuredClone(CRM_DOCUMENTS),
    audit: [],
  };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function readStore(): Store {
  if (!canUseStorage()) {
    if (!memoryStore) memoryStore = seedStore();
    return memoryStore;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedStore();
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Store;
    parsed.warranties = refreshWarrantyStatuses(parsed.warranties);
    parsed.contracts = parsed.contracts.map((c) => ({
      ...c,
      status: c.status === "DRAFT" ? "DRAFT" : calculateContractStatus(c.endDate),
    }));
    return parsed;
  } catch {
    return seedStore();
  }
}

function writeStore(store: Store): void {
  memoryStore = store;
  if (!canUseStorage()) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pushAudit(
  store: Store,
  entry: Omit<CrmAuditEntry, "id" | "occurredAt">,
): Store {
  const row: CrmAuditEntry = {
    id: id("crm-aud"),
    occurredAt: nowIso(),
    ...entry,
  };
  return { ...store, audit: [row, ...store.audit] };
}

export function listCustomers(page = 1, pageSize = 25) {
  return paginate(readStore().customers, page, pageSize);
}

export function getCustomer(customerId: string): CrmCustomer | null {
  return readStore().customers.find((c) => c.id === customerId) ?? null;
}

export function listChildCustomers(parentId: string): CrmCustomer[] {
  return readStore().customers.filter((c) => c.parentCustomerId === parentId);
}

export function createCustomer(
  input: Omit<CrmCustomer, "id" | "createdAt" | "updatedAt">,
): { ok: boolean; error?: string; customer?: CrmCustomer } {
  if (!input.name.trim() || !input.customerNumber.trim()) {
    return { ok: false, error: "Name and customer number are required." };
  }
  const store = readStore();
  if (
    store.customers.some(
      (c) => c.customerNumber.toLowerCase() === input.customerNumber.toLowerCase(),
    )
  ) {
    return { ok: false, error: "Customer number must be unique." };
  }
  const ts = nowIso();
  const customer: CrmCustomer = {
    ...input,
    id: id("cust"),
    createdAt: ts,
    updatedAt: ts,
  };
  let next = { ...store, customers: [customer, ...store.customers] };
  next = pushAudit(next, {
    entityType: "Customer",
    entityId: customer.id,
    field: "created",
    previousValue: "",
    newValue: customer.customerNumber,
    actor: "Matrix User",
  });
  writeStore(next);
  return { ok: true, customer };
}

export function updateCustomer(
  customerId: string,
  patch: Partial<CrmCustomer>,
  actor = "Matrix User",
): { ok: boolean; error?: string; customer?: CrmCustomer } {
  const store = readStore();
  const idx = store.customers.findIndex((c) => c.id === customerId);
  if (idx < 0) return { ok: false, error: "Customer not found." };
  const prev = store.customers[idx];
  const updated = { ...prev, ...patch, id: prev.id, updatedAt: nowIso() };
  const customers = [...store.customers];
  customers[idx] = updated;
  let next = { ...store, customers };
  for (const key of Object.keys(patch) as (keyof CrmCustomer)[]) {
    if (String(prev[key] ?? "") !== String(updated[key] ?? "")) {
      next = pushAudit(next, {
        entityType: "Customer",
        entityId: customerId,
        field: String(key),
        previousValue: String(prev[key] ?? ""),
        newValue: String(updated[key] ?? ""),
        actor,
      });
    }
  }
  writeStore(next);
  return { ok: true, customer: updated };
}

export function listContacts(customerId: string): CrmContact[] {
  return readStore().contacts.filter((c) => c.customerId === customerId);
}

export function createContact(
  input: Omit<CrmContact, "id">,
): { ok: boolean; error?: string; contact?: CrmContact } {
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  const store = readStore();
  let contacts = [...store.contacts];
  if (input.isPrimary) {
    contacts = contacts.map((c) =>
      c.customerId === input.customerId ? { ...c, isPrimary: false } : c,
    );
  }
  const contact: CrmContact = { ...input, id: id("ctc") };
  let next = { ...store, contacts: [contact, ...contacts] };
  next = pushAudit(next, {
    entityType: "Contact",
    entityId: contact.id,
    field: "created",
    previousValue: "",
    newValue: contact.name,
    actor: "Matrix User",
  });
  writeStore(next);
  return { ok: true, contact };
}

export function listSites(customerId?: string, page = 1, pageSize = 50) {
  const all = readStore().sites;
  const filtered = customerId
    ? all.filter((s) => s.customerId === customerId)
    : all;
  return paginate(filtered, page, pageSize);
}

export function getSite(siteId: string): CrmSite | null {
  return readStore().sites.find((s) => s.id === siteId) ?? null;
}

export function createSite(
  input: Omit<CrmSite, "id">,
): { ok: boolean; error?: string; site?: CrmSite } {
  if (!input.name.trim() || !input.siteNumber.trim()) {
    return { ok: false, error: "Site name and number are required." };
  }
  const store = readStore();
  const site: CrmSite = { ...input, id: id("site") };
  let next = { ...store, sites: [site, ...store.sites] };
  next = pushAudit(next, {
    entityType: "Site",
    entityId: site.id,
    field: "created",
    previousValue: "",
    newValue: site.siteNumber,
    actor: "Matrix User",
  });
  writeStore(next);
  return { ok: true, site };
}

export function listAssets(filter?: {
  customerId?: string;
  siteId?: string;
  page?: number;
  pageSize?: number;
}) {
  let assets = readStore().assets;
  if (filter?.customerId) {
    assets = assets.filter((a) => a.customerId === filter.customerId);
  }
  if (filter?.siteId) {
    assets = assets.filter((a) => a.siteId === filter.siteId);
  }
  return paginate(assets, filter?.page ?? 1, filter?.pageSize ?? 50);
}

export function getAsset(assetId: string): CrmAsset | null {
  return readStore().assets.find((a) => a.id === assetId) ?? null;
}

export function assignAssetToSite(
  assetId: string,
  siteId: string,
  actor = "Matrix User",
): { ok: boolean; error?: string; asset?: CrmAsset } {
  const store = readStore();
  const asset = store.assets.find((a) => a.id === assetId);
  const site = store.sites.find((s) => s.id === siteId);
  if (!asset) return { ok: false, error: "Asset not found." };
  if (!site) return { ok: false, error: "Site not found." };
  const updated: CrmAsset = {
    ...asset,
    siteId,
    customerId: site.customerId,
  };
  const assets = store.assets.map((a) => (a.id === assetId ? updated : a));
  let next = { ...store, assets };
  next = pushAudit(next, {
    entityType: "Asset",
    entityId: assetId,
    field: "siteId",
    previousValue: asset.siteId,
    newValue: siteId,
    actor,
  });
  const event: LifecycleEvent = {
    id: id("lc"),
    assetId,
    type: "RELOCATED",
    occurredAt: nowIso(),
    actor,
    summary: `Relocated to ${site.name}`,
    details: `Site ${site.siteNumber}`,
  };
  next = { ...next, lifecycle: [event, ...next.lifecycle] };
  writeStore(next);
  return { ok: true, asset: updated };
}

export function createAsset(
  input: Omit<CrmAsset, "id">,
): { ok: boolean; error?: string; asset?: CrmAsset } {
  if (!input.assetNumber.trim() || !input.serialNumber.trim()) {
    return { ok: false, error: "Asset number and serial are required." };
  }
  const store = readStore();
  if (
    store.assets.some(
      (a) => a.assetNumber.toLowerCase() === input.assetNumber.toLowerCase(),
    )
  ) {
    return { ok: false, error: "Asset number must be unique." };
  }
  const asset: CrmAsset = { ...input, id: id("asset") };
  let next = { ...store, assets: [asset, ...store.assets] };
  next = pushAudit(next, {
    entityType: "Asset",
    entityId: asset.id,
    field: "created",
    previousValue: "",
    newValue: asset.assetNumber,
    actor: "Matrix User",
  });
  if (asset.installDate) {
    next = {
      ...next,
      lifecycle: [
        {
          id: id("lc"),
          assetId: asset.id,
          type: "INSTALLED",
          occurredAt: asset.installDate,
          actor: "Matrix User",
          summary: "Asset created / installed",
          details: "",
        },
        ...next.lifecycle,
      ],
    };
  }
  writeStore(next);
  return { ok: true, asset };
}

export function listLifecycle(assetId: string): LifecycleEvent[] {
  return readStore()
    .lifecycle.filter((e) => e.assetId === assetId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function addLifecycleEvent(
  input: Omit<LifecycleEvent, "id">,
): LifecycleEvent {
  const store = readStore();
  const event: LifecycleEvent = { ...input, id: id("lc") };
  let next = { ...store, lifecycle: [event, ...store.lifecycle] };
  next = pushAudit(next, {
    entityType: "LifecycleEvent",
    entityId: event.id,
    field: "type",
    previousValue: "",
    newValue: event.type,
    actor: event.actor,
  });
  writeStore(next);
  return event;
}

export function listRelationships(assetId: string): AssetRelationship[] {
  return readStore().relationships.filter((r) => r.parentAssetId === assetId);
}

export function listContracts(customerId?: string): CrmContract[] {
  const all = readStore().contracts;
  return customerId ? all.filter((c) => c.customerId === customerId) : all;
}

export function listExpiringContracts(withinDays = 90): CrmContract[] {
  return contractsApproachingExpiration(readStore().contracts, withinDays);
}

export function listWarranties(assetId?: string): CrmWarranty[] {
  const all = readStore().warranties;
  return assetId ? all.filter((w) => w.assetId === assetId) : all;
}

export function primaryWarrantyStatus(assetId: string): CrmWarranty["status"] {
  const wars = listWarranties(assetId);
  if (!wars.length) return "NONE";
  if (wars.some((w) => w.status === "ACTIVE")) return "ACTIVE";
  if (wars.some((w) => w.status === "EXPIRING_SOON")) return "EXPIRING_SOON";
  return "EXPIRED";
}

export function listDocuments(filter?: {
  customerId?: string;
  siteId?: string;
  assetId?: string;
}): CrmDocument[] {
  let docs = readStore().documents;
  if (filter?.customerId) docs = docs.filter((d) => d.customerId === filter.customerId);
  if (filter?.siteId) docs = docs.filter((d) => d.siteId === filter.siteId);
  if (filter?.assetId) docs = docs.filter((d) => d.assetId === filter.assetId);
  return docs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function addDocumentVersion(
  previousId: string,
  uploadedBy: string,
  storageRef: string,
): { ok: boolean; error?: string; document?: CrmDocument } {
  const store = readStore();
  const prev = store.documents.find((d) => d.id === previousId);
  if (!prev) return { ok: false, error: "Document not found." };
  const doc: CrmDocument = {
    ...prev,
    id: id("doc"),
    version: prev.version + 1,
    uploadedAt: nowIso(),
    uploadedBy,
    storageRef,
  };
  writeStore({ ...store, documents: [doc, ...store.documents] });
  return { ok: true, document: doc };
}

export function listAudit(entityId?: string, limit = 100): CrmAuditEntry[] {
  let rows = readStore().audit;
  if (entityId) rows = rows.filter((a) => a.entityId === entityId);
  return rows.slice(0, limit);
}

export function getCustomerDashboard(customerId: string) {
  const store = readStore();
  const customer = store.customers.find((c) => c.id === customerId);
  if (!customer) return null;
  const sites = store.sites.filter((s) => s.customerId === customerId);
  const assets = store.assets.filter((a) => a.customerId === customerId);
  const contracts = store.contracts.filter((c) => c.customerId === customerId);
  const warranties = store.warranties.filter((w) =>
    assets.some((a) => a.id === w.assetId),
  );
  const lifecycle = store.lifecycle
    .filter((e) => assets.some((a) => a.id === e.assetId))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8)
    .map((e) => ({ label: `${e.type.replaceAll("_", " ")} — ${e.summary}`, at: e.occurredAt }));

  return buildCustomerDashboard({
    customer,
    sitesCount: sites.length,
    assets,
    openWorkOrders: assets.filter((a) => a.status === "DOWN" || a.status === "MAINTENANCE")
      .length,
    upcomingPMs: 2,
    overduePMs: assets.filter((a) => a.status === "MAINTENANCE").length,
    serviceCallsThisMonth: 3,
    contractStatus: contracts[0]?.status ?? "NONE",
    warranties,
    recentActivity: lifecycle,
  });
}

export function getSiteDashboard(siteId: string) {
  const store = readStore();
  const site = store.sites.find((s) => s.id === siteId);
  if (!site) return null;
  const assets = store.assets.filter((a) => a.siteId === siteId);
  return buildSiteDashboard({
    assets,
    openWorkOrders: assets.filter((a) => a.status !== "ACTIVE" && a.status !== "LOANER")
      .length,
    scheduledVisits: 1,
    upcomingPMs: 1,
    recentRepairs: store.lifecycle.filter(
      (e) =>
        e.type === "REPAIRED" && assets.some((a) => a.id === e.assetId),
    ).length,
    partsConsumed: 4,
    technicianAssigned: site.assignedTechnician,
  });
}

export function crmSearch(query: string, page = 1, pageSize = 25) {
  const store = readStore();
  return searchCrm({
    query,
    customers: store.customers,
    sites: store.sites,
    assets: store.assets,
    contacts: store.contacts,
    contracts: store.contracts,
    page,
    pageSize,
  });
}

export function lookupAssetByScan(code: string): CrmAsset | null {
  return resolveAssetByCode(code, readStore().assets);
}

export function runCrmReport(type: CrmReportType) {
  const store = readStore();
  return generateCrmReport(type, {
    customers: store.customers,
    assets: store.assets,
    contracts: store.contracts,
    warranties: store.warranties,
  });
}

export function resetCrmForTests(): void {
  memoryStore = null;
  if (canUseStorage()) sessionStorage.removeItem(STORAGE_KEY);
}
