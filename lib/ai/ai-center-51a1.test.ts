/**
 * Patch 51A.1 Part 1 — AI Operations Center foundation tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRoute,
  hasMatrixPermission,
} from "@/lib/auth/permissions";
import { aiConfig } from "@/config/ai";
import { AIEngine } from "@/services/ai/AIEngine";
import { AIChatService } from "@/services/ai/AIChatService";

describe("Patch 51A.1 AI Center permissions", () => {
  it("grants AI center permissions to ADMIN and SUPER_ADMIN only", () => {
    assert.equal(hasMatrixPermission("SUPER_ADMIN", "VIEW_AI_CENTER"), true);
    assert.equal(hasMatrixPermission("ADMIN", "MANAGE_AI"), true);
    assert.equal(hasMatrixPermission("ADMIN", "AI_ADMIN"), true);
    assert.equal(hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_AI_CENTER"), false);
    assert.equal(hasMatrixPermission("SERVICE_MANAGER", "AI_ADMIN"), false);
    assert.equal(hasMatrixPermission("CUSTOMER_ADMIN", "VIEW_AI_CENTER"), false);
  });

  it("gates /ai route to VIEW_AI_CENTER", () => {
    assert.equal(canAccessRoute("ADMIN", "/ai"), true);
    assert.equal(canAccessRoute("FIELD_TECHNICIAN", "/ai"), false);
  });
});

describe("Patch 51A.1 AI config", () => {
  it("keeps chat disabled and defaults confidence to 98", () => {
    assert.equal(aiConfig.enabled, true);
    assert.equal(aiConfig.learningEnabled, true);
    assert.equal(aiConfig.chatEnabled, false);
    assert.equal(aiConfig.defaultConfidence, 98);
    assert.equal(aiConfig.version, "Matrix AI Core 1.0");
  });
});

describe("Patch 51A.1 AIEngine interfaces", () => {
  it("exposes orchestrator methods", () => {
    const engine = new AIEngine();
    assert.equal(typeof engine.status, "function");
    assert.equal(typeof engine.summary, "function");
    assert.equal(typeof engine.recommendations, "function");
    assert.equal(typeof engine.predictions, "function");
    assert.equal(typeof engine.metrics, "function");
    assert.equal(typeof engine.logs, "function");
    assert.equal(typeof engine.chat, "function");
    assert.equal(typeof engine.fleet, "function");
  });

  it("chat service reports chat disabled by default", () => {
    const chat = new AIChatService();
    assert.equal(chat.isEnabled(), false);
  });
});
