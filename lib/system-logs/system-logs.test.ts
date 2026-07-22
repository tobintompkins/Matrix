/**
 * Patch 50C-2 — System Logs unit tests.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyAction } from "./taxonomy";
import { redactObject, redactPayloadJson } from "./redaction";
import { hasMatrixPermission } from "@/lib/auth/permissions";

describe("system log taxonomy", () => {
  it("classifies role changes as authorization/security candidates", () => {
    const c = classifyAction("USER_ROLE_CHANGED");
    assert.equal(c.category, "AUTHORIZATION");
    assert.equal(c.isSecurityCandidate, true);
  });

  it("classifies data quality and approval actions", () => {
    assert.equal(classifyAction("DATA_QUALITY_SCAN_COMPLETED").category, "DATA_QUALITY");
    assert.equal(classifyAction("APPROVAL_SUBMITTED").category, "APPROVAL");
  });

  it("classifies export and failed login patterns", () => {
    assert.equal(classifyAction("SYSTEM_LOG_EXPORTED").category, "EXPORT");
    const fail = classifyAction("LOGIN_FAILED");
    assert.equal(fail.category, "AUTHENTICATION");
    assert.equal(fail.outcome, "FAILURE");
  });
});

describe("system log redaction", () => {
  it("redacts password, token, and authorization fields", () => {
    const out = redactObject({
      password: "secret",
      apiKey: "abc",
      authorization: "Bearer xyz",
      safe: "ok",
    });
    assert.equal(out.password, "[SECRET]");
    assert.equal(out.apiKey, "[SECRET]");
    assert.equal(out.authorization, "[SECRET]");
    assert.equal(out.safe, "ok");
  });

  it("redacts JWT-like values in payload JSON", () => {
    const raw = JSON.stringify({
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
      name: "Jordan",
    });
    const redacted = redactPayloadJson(raw);
    assert.ok(redacted);
    assert.equal(redacted!.includes("eyJ"), false);
    assert.equal(redacted!.includes("Jordan"), true);
  });
});

describe("system log permissions", () => {
  it("denies field technicians by default", () => {
    assert.equal(
      hasMatrixPermission("FIELD_TECHNICIAN", "VIEW_SYSTEM_LOGS"),
      false,
    );
  });

  it("allows administrators full system log access", () => {
    assert.equal(hasMatrixPermission("ADMIN", "VIEW_SYSTEM_LOGS"), true);
    assert.equal(hasMatrixPermission("ADMIN", "VIEW_SECURITY_LOGS"), true);
    assert.equal(hasMatrixPermission("ADMIN", "EXPORT_SYSTEM_LOGS"), true);
    assert.equal(
      hasMatrixPermission("ADMIN", "VIEW_SENSITIVE_LOG_METADATA"),
      true,
    );
  });
});
