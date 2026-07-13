import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  addLifecycleEvent,
  assignAssetToSite,
  calculateContractStatus,
  calculateWarrantyStatus,
  createAsset,
  createContact,
  createCustomer,
  createSite,
  crmSearch,
  getCustomer,
  getCustomerDashboard,
  getSiteDashboard,
  listAudit,
  listExpiringContracts,
  listLifecycle,
  lookupAssetByScan,
  resetCrmForTests,
  runCrmReport,
} from "./index";

describe("CRM Patch 40", () => {
  beforeEach(() => {
    resetCrmForTests();
  });

  it("creates customers with unique numbers and audit", () => {
    const r = createCustomer({
      customerNumber: "CUST-TEST-1",
      name: "Test Co",
      status: "ACTIVE",
      industry: "Print",
      parentCustomerId: null,
      taxId: null,
      billingAddress: "1 Main",
      primaryAddress: "1 Main",
      notes: "",
      website: "",
      timeZone: "America/New_York",
      preferredBusinessHours: "9-5",
    });
    assert.equal(r.ok, true);
    assert.ok(r.customer);
    assert.equal(getCustomer(r.customer!.id)?.name, "Test Co");
    assert.ok(listAudit(r.customer!.id).length >= 1);

    const dup = createCustomer({
      customerNumber: "CUST-TEST-1",
      name: "Dup",
      status: "PROSPECT",
      industry: "",
      parentCustomerId: null,
      taxId: null,
      billingAddress: "",
      primaryAddress: "",
      notes: "",
      website: "",
      timeZone: "UTC",
      preferredBusinessHours: "",
    });
    assert.equal(dup.ok, false);
  });

  it("creates sites and assigns assets", () => {
    const cust = createCustomer({
      customerNumber: "CUST-SITE-1",
      name: "Site Cust",
      status: "ACTIVE",
      industry: "",
      parentCustomerId: null,
      taxId: null,
      billingAddress: "",
      primaryAddress: "Addr",
      notes: "",
      website: "",
      timeZone: "UTC",
      preferredBusinessHours: "",
    });
    assert.ok(cust.customer);
    const site = createSite({
      customerId: cust.customer!.id,
      siteNumber: "S-1",
      name: "HQ",
      physicalAddress: "Addr",
      latitude: null,
      longitude: null,
      timeZone: "UTC",
      businessHours: "9-5",
      loadingDockInstructions: "",
      parkingInstructions: "",
      securityProcedures: "",
      buildingAccessInstructions: "",
      afterHoursAccess: "",
      siteNotes: "",
      assignedTechnician: "Tech A",
    });
    assert.equal(site.ok, true);

    const asset = createAsset({
      customerId: cust.customer!.id,
      siteId: site.site!.id,
      assetNumber: "MX-TEST-001",
      serialNumber: "SN-TEST-001",
      model: "GD9630",
      firmwareVersion: "1.0",
      controllerVersion: "C-1",
      installDate: "2025-01-01",
      warrantyStart: "2025-01-01",
      warrantyEnd: "2028-01-01",
      purchaseDate: "2024-12-01",
      leaseInfo: "",
      ownership: "Owned",
      status: "ACTIVE",
      macAddress: "",
      ipAddress: "10.0.0.9",
      hostname: "test-host",
      department: "Ops",
      floor: "1",
      room: "A",
      latitude: null,
      longitude: null,
      qrLabel: "QR-MX-TEST-001",
      barcode: "BC-MX-TEST-001",
      currentCopyCount: 1000,
      monthlyVolume: 100,
      nickname: "Test",
      digitalTwinId: null,
    });
    assert.equal(asset.ok, true);
    assert.ok(listLifecycle(asset.asset!.id).some((e) => e.type === "INSTALLED"));

    const site2 = createSite({
      customerId: cust.customer!.id,
      siteNumber: "S-2",
      name: "South",
      physicalAddress: "South",
      latitude: null,
      longitude: null,
      timeZone: "UTC",
      businessHours: "",
      loadingDockInstructions: "",
      parkingInstructions: "",
      securityProcedures: "",
      buildingAccessInstructions: "",
      afterHoursAccess: "",
      siteNotes: "",
      assignedTechnician: "",
    });
    const moved = assignAssetToSite(asset.asset!.id, site2.site!.id);
    assert.equal(moved.ok, true);
    assert.equal(moved.asset?.siteId, site2.site!.id);
    assert.ok(listLifecycle(asset.asset!.id).some((e) => e.type === "RELOCATED"));
  });

  it("calculates warranty and contract expiration", () => {
    assert.equal(calculateWarrantyStatus("2020-01-01", new Date("2026-07-10")), "EXPIRED");
    assert.equal(calculateWarrantyStatus("2026-08-01", new Date("2026-07-10")), "EXPIRING_SOON");
    assert.equal(calculateWarrantyStatus("2028-01-01", new Date("2026-07-10")), "ACTIVE");
    assert.equal(calculateContractStatus("2026-08-15", new Date("2026-07-10")), "EXPIRING_SOON");
    assert.ok(listExpiringContracts(365).length >= 1);
  });

  it("logs lifecycle events and builds dashboards", () => {
    addLifecycleEvent({
      assetId: "asset-mx-gd-002",
      type: "PM_COMPLETED",
      occurredAt: "2026-07-09T10:00:00.000Z",
      actor: "Tech",
      summary: "PM done",
      details: "",
    });
    assert.ok(listLifecycle("asset-mx-gd-002").some((e) => e.summary === "PM done"));
    const dash = getCustomerDashboard("cust-sfx");
    assert.ok(dash);
    assert.ok(dash!.totalPrinters >= 1);
    assert.ok(dash!.totalSites >= 1);
    const siteDash = getSiteDashboard("site-sfx-main");
    assert.ok(siteDash);
    assert.ok(siteDash!.printerCount >= 1);
  });

  it("searches CRM entities and resolves QR codes", () => {
    const hits = crmSearch("MX-GD-002");
    assert.ok(hits.total >= 1);
    assert.ok(hits.hits.some((h) => h.kind === "ASSET"));
    const byIp = crmSearch("10.10.1.42");
    assert.ok(byIp.hits.some((h) => h.kind === "ASSET"));
    const byContact = crmSearch("Toby");
    assert.ok(byContact.hits.some((h) => h.kind === "CONTACT"));
    const asset = lookupAssetByScan("QR-MX-GD-002");
    assert.equal(asset?.assetNumber, "MX-GD-002");
  });

  it("creates contacts and runs reports", () => {
    const contact = createContact({
      customerId: "cust-sfx",
      name: "New Contact",
      jobTitle: "Ops",
      department: "IT",
      email: "ops@example.com",
      officePhone: "",
      mobilePhone: "",
      preferredContactMethod: "EMAIL",
      emergencyContact: false,
      receiveServiceNotifications: true,
      receiveMaintenanceReports: true,
      isPrimary: false,
      notes: "",
    });
    assert.equal(contact.ok, true);
    const report = runCrmReport("CONTRACT_EXPIRATION");
    assert.equal(report.title, "Contract Expiration");
    assert.ok(report.rows.length >= 1);
    const fleet = runCrmReport("FLEET_HEALTH");
    assert.ok(fleet.rows.length >= 1);
  });
});
