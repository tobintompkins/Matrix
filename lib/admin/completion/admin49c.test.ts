import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRoute,
  hasMatrixPermission,
} from "@/lib/auth/permissions";
import { getExecutiveAdminSummary } from "./executive";
import { ADMIN_REPORT_CATALOG, generateAdminReportCsv } from "./reports";
import { getUsageAnalytics } from "./usage";
import { getBackupStatus, requestManualBackup } from "./backups";
import { getVersionInformation } from "./version";
import { listIntegrations, testIntegrationConnection } from "./integrations";
import { validateImportBatch, parseCsvText } from "./import-export";
import { sanitizeImportCell } from "./csv";
import { ADMIN_TOOLS, runAdminTool } from "./admin-tools";
import { createCustomField, deactivateCustomField, listCustomFields } from "./custom-fields";
import { createAnnouncement, listActiveAnnouncementsForHub } from "./announcements";

describe("Patch 49C permissions and routes", () => {
  it("exposes 49C routes to admins and hides from technicians", () => {
    assert.equal(canAccessRoute("ADMIN", "/admin/executive"), true);
    assert.equal(canAccessRoute("ADMIN", "/admin/system-health"), true);
    assert.equal(canAccessRoute("ADMIN", "/admin/import-export"), true);
    assert.equal(canAccessRoute("DIRECTOR", "/admin/executive"), true);
    assert.equal(canAccessRoute("DIRECTOR", "/admin/tools"), false);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/admin/executive"), false);
  });

  it("keeps directors without destructive system tools", () => {
    assert.equal(hasMatrixPermission("DIRECTOR", "VIEW_EXECUTIVE_ADMIN_DASHBOARD"), true);
    assert.equal(hasMatrixPermission("DIRECTOR", "VIEW_ADMIN_TOOLS"), false);
    assert.equal(hasMatrixPermission("DIRECTOR", "IMPORT_OPERATIONAL_DATA"), false);
  });
});

describe("Executive and reports", () => {
  it("builds executive summary without fabricating PM compliance", () => {
    const summary = getExecutiveAdminSummary("LAST_30");
    assert.ok(summary.cards.length > 0);
    assert.ok(summary.notes.some((n) => n.includes("PM compliance")));
    assert.ok(summary.cards.every((c) => typeof c.value === "number"));
  });

  it("generates CSV for catalog reports", () => {
    assert.ok(ADMIN_REPORT_CATALOG.length > 0);
    const result = generateAdminReportCsv("service-calls-by-status");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.ok(result.csv.includes("WorkOrder"));
    }
  });
});

describe("Usage, version, backups, integrations", () => {
  it("returns usage analytics notes for unverified personal tracking", () => {
    const usage = getUsageAnalytics();
    assert.ok(usage.modules.length > 0);
    assert.ok(usage.notes.length > 0);
  });

  it("uses real package version metadata", () => {
    const version = getVersionInformation();
    assert.ok(version.version.length > 0);
    assert.ok(version.releaseHistory.some((r) => r.patchName.includes("49C")));
  });

  it("does not claim unverified backups or fake manual backup", () => {
    const backup = getBackupStatus();
    assert.equal(backup.manualBackupAvailable, false);
    assert.equal(backup.restoreAvailable, false);
    assert.equal(requestManualBackup().ok, false);
  });

  it("lists integrations without exposing secrets", () => {
    const cards = listIntegrations();
    assert.ok(cards.some((c) => c.key === "clerk"));
    for (const card of cards) {
      assert.equal("secretValue" in card, false);
    }
    const email = cards.find((c) => c.key === "email");
    assert.equal(email?.status, "Not Supported");
  });

  it("tests clerk integration safely", () => {
    const result = testIntegrationConnection("email");
    assert.equal(result.ok, false);
  });
});

describe("Import safety and admin tools", () => {
  it("blocks formula injection prefixes in import cells", () => {
    assert.equal(sanitizeImportCell("=CMD()"), "'=CMD()");
    const parsed = parseCsvText("name,customerNumber\nAcme,C1");
    assert.equal(parsed.length, 2);
  });

  it("validates import batches", () => {
    const batch = validateImportBatch({
      importType: "CUSTOMERS",
      mode: "VALIDATE_ONLY",
      csvText: "name,customerNumber\n,missing-name",
    });
    assert.ok(batch.invalid >= 1);
  });

  it("runs scan-only relationship validation", () => {
    const tool = ADMIN_TOOLS.find((t) => t.id === "validate-relationships");
    assert.ok(tool?.scanOnlyDefault);
    const result = runAdminTool("validate-relationships", "Test Admin");
    assert.equal(result.ok, true);
  });
});

describe("Announcements and custom fields", () => {
  it("creates sanitized announcements", () => {
    const result = createAnnouncement({
      title: "Hub notice",
      message: "<script>x</script>Service window tonight",
      audience: "ALL_USERS",
      actorUserId: "u1",
      actorName: "Admin",
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.announcement.message.includes("<script>"), false);
      assert.ok(listActiveAnnouncementsForHub().length >= 1);
    }
  });

  it("deactivates custom fields instead of hard delete", () => {
    const created = createCustomField({
      organizationId: "org-sfx",
      recordType: "CUSTOMER",
      label: "Site Code 49C",
      fieldType: "SHORT_TEXT",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(deactivateCustomField(created.field.id).ok, true);
    assert.equal(
      listCustomFields("CUSTOMER").find((f) => f.id === created.field.id)?.active,
      false,
    );
  });
});
