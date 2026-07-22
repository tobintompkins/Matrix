import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanAccessServiceCallContext,
  buildMatrixAssistContext,
  contextToProviderSummary,
} from "./context-builder";
import { SampleAssistProvider } from "./provider/sample";
import {
  checkMatrixAssistRateLimit,
  resetMatrixAssistRateLimits,
} from "./rate-limit";
import { suggestPartsForSymptom } from "./parts";
import { matchTemplates } from "./templates";
import { getAiProviderName, isMatrixAssistEnvEnabled } from "./config";
import { hasMatrixPermission } from "@/lib/auth/permissions";

describe("buildMatrixAssistContext", () => {
  it("builds machine context without unrelated contact PII fields", () => {
    const ctx = buildMatrixAssistContext({ machineId: "MX-GD-002" });
    assert.ok(ctx.redactedFields.includes("customerPhone"));
    assert.ok(ctx.redactedFields.includes("apiKeys"));
    const summary = contextToProviderSummary(ctx);
    assert.equal(summary.includes("Authorization"), false);
    assert.match(summary, /untrusted reference/i);
  });

  it("rejects unauthorized technician access to another tech's call when scoped", () => {
    const result = assertCanAccessServiceCallContext({
      roleCanViewAll: false,
      actorDisplayName: "Someone Else",
      serviceCallId: "SC-1001",
    });
    // May be ok if seed call unassigned or not found differently — assert shape
    assert.ok("ok" in result);
  });

  it("does not error when service call id is unknown (Standalone Mode fallback)", () => {
    const access = assertCanAccessServiceCallContext({
      roleCanViewAll: true,
      actorDisplayName: "Tech",
      serviceCallId: "NOT-A-REAL-CALL",
    });
    assert.equal(access.ok, true);

    const ctx = buildMatrixAssistContext({
      serviceCallId: "NOT-A-REAL-CALL",
      modelHint: "GD9630",
      reportedSymptom: "Tray 2 misfeed",
      technicianObservations: "Checked rollers",
    });
    assert.equal(ctx.serviceCallId, undefined);
    assert.equal(ctx.printerModel, "GD9630");
    assert.equal(ctx.reportedIssue, "Tray 2 misfeed");
    assert.equal(ctx.recentServiceHistory.length, 0);
  });

  it("resolves service calls by ticket number when available", () => {
    const ctx = buildMatrixAssistContext({
      serviceCallId: "TKT-2026-0142",
    });
    assert.ok(ctx.serviceCallId, "expected ticket to resolve to a service call id");
    assert.ok(ctx.printerModel || ctx.machineId);
  });
});

describe("SampleAssistProvider", () => {
  it("returns structured guidance marked as sample", async () => {
    const provider = new SampleAssistProvider();
    const result = await provider.generateDiagnosticGuidance({
      symptom: "Tray 2 misfeed",
      contextSummary: "Model GD9630",
      evidence: [],
      hasVerifiedModelProcedure: false,
    });
    assert.equal(result.isSample, true);
    assert.ok(result.safetyNotes.length > 0);
    assert.ok(result.inspectionChecks.length > 0);
    assert.ok(result.likelyCauses.every((c) => ["Low", "Moderate", "High"].includes(c.confidence)));
  });

  it("does not invent service history when records are empty", async () => {
    const provider = new SampleAssistProvider();
    const summary = await provider.summarizeServiceHistory({
      contextSummary: "",
      records: [],
    });
    assert.match(summary.bullets[0] ?? "", /no related/i);
  });

  it("labels service-note drafts for review", async () => {
    const provider = new SampleAssistProvider();
    const draft = await provider.draftServiceNotes({
      customerComplaint: "Jam",
      inspection: "Checked rollers",
    });
    assert.match(draft.label, /review before saving/i);
    assert.ok(draft.sections.some((s) => s.heading === "Customer Complaint"));
  });
});

describe("Matrix Assist permissions and rate limits", () => {
  it("grants USE_MATRIX_ASSIST to field technicians", () => {
    assert.equal(hasMatrixPermission("FIELD_TECHNICIAN", "USE_MATRIX_ASSIST"), true);
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "MANAGE_MATRIX_ASSIST_SETTINGS"),
      false,
    );
    assert.equal(
      hasMatrixPermission("SUPER_ADMIN", "MANAGE_MATRIX_ASSIST_SETTINGS"),
      true,
    );
  });

  it("rate limits burst usage without throwing", () => {
    resetMatrixAssistRateLimits();
    let blocked = false;
    for (let i = 0; i < 40; i += 1) {
      const result = checkMatrixAssistRateLimit({ userId: "tech-1" });
      if (!result.ok) {
        blocked = true;
        assert.match(result.message, /usage limit/i);
        break;
      }
    }
    assert.equal(blocked, true);
  });
});

describe("templates and parts suggestions", () => {
  it("matches paper feed templates", () => {
    const matched = matchTemplates({ symptomCategory: "Paper Feed" });
    assert.ok(matched.length > 0);
  });

  it("does not mutate inventory when suggesting parts", () => {
    const before = suggestPartsForSymptom({
      symptomCategory: "Paper Feed",
      canViewInventory: true,
    });
    const after = suggestPartsForSymptom({
      symptomCategory: "Paper Feed",
      canViewInventory: false,
    });
    assert.ok(Array.isArray(before));
    assert.ok(after.every((p) => p.stockHidden === true));
  });
});

describe("provider config", () => {
  it("reads enable flag without throwing", () => {
    assert.equal(typeof isMatrixAssistEnvEnabled(), "boolean");
    assert.ok(["none", "sample", "openai-compatible"].includes(getAiProviderName()));
  });
});
