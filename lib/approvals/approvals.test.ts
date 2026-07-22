/**
 * Patch 50A — Approval Center unit tests (pure helpers + authz).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateCondition,
  evaluateConditions,
  validateWorkflowDefinition,
  defaultAdminWorkflow,
} from "./rules";
import {
  generateDecisionSignature,
  verifyDecisionSignature,
} from "./signature";
import {
  formatWaitingDuration,
  classifySla,
  isOverdue,
} from "./waiting";
import { sanitizeCommentBody, sanitizeTitle } from "./sanitize";
import {
  canViewApproval,
  canActOnStep,
  isClosedStatus,
} from "./authorization";
import { registerApprovalType, getApprovalType } from "./registry";
import type { AdminActor } from "@/lib/admin/auth";
import type { ApprovalRuleContext } from "./types";

const adminActor: AdminActor = {
  role: "ADMIN",
  displayName: "Admin",
  userId: "admin-1",
  organizationId: "org-sfx",
  regionId: null,
  authenticated: true,
};

const techActor: AdminActor = {
  role: "FIELD_TECHNICIAN",
  displayName: "Tech",
  userId: "tech-1",
  organizationId: "org-sfx",
  regionId: null,
  authenticated: true,
};

describe("approval rule conditions", () => {
  it("evaluates numeric and equality operators", () => {
    assert.equal(
      evaluateCondition(2500, { operator: "GREATER_THAN", value: 2000 }),
      true,
    );
    assert.equal(
      evaluateCondition("CRITICAL", { operator: "EQUALS", value: "CRITICAL" }),
      true,
    );
    assert.equal(
      evaluateCondition("A", { operator: "IN", value: ["A", "B"] }),
      true,
    );
    assert.equal(evaluateCondition("", { operator: "IS_EMPTY" }), true);
  });

  it("matches compound conditions against context", () => {
    const ctx: ApprovalRuleContext = {
      organizationId: "org-sfx",
      approvalType: "PARTS_ORDER",
      requestedAmount: 3000,
      priority: "HIGH",
    };
    assert.equal(
      evaluateConditions(ctx, {
        requestedAmount: { operator: "GREATER_THAN", value: 2000 },
        approvalType: { operator: "EQUALS", value: "PARTS_ORDER" },
      }),
      true,
    );
    assert.equal(
      evaluateConditions(ctx, {
        requestedAmount: { operator: "LESS_THAN", value: 100 },
      }),
      false,
    );
  });

  it("validates workflow definitions", () => {
    const steps = validateWorkflowDefinition({
      steps: [
        { stepNumber: 2, name: "Exec", requiredPermission: "APPROVE_REQUEST" },
        { stepNumber: 1, name: "Mgr", requiredPermission: "APPROVE_REQUEST" },
      ],
    });
    assert.equal(steps[0].stepNumber, 1);
    assert.throws(() => validateWorkflowDefinition({ steps: [] }));
    assert.ok(defaultAdminWorkflow().steps.length >= 1);
  });
});

describe("decision signature", () => {
  it("generates and verifies HMAC hashes", () => {
    const payload = {
      approvalRequestId: "req-1",
      approvalStepId: "step-1",
      decision: "APPROVED",
      decidedByUserId: "user-1",
      decidedByRoleName: "ADMIN",
      decidedAtIso: "2026-07-14T12:00:00.000Z",
      organizationId: "org-sfx",
    };
    const hash = generateDecisionSignature(payload);
    assert.equal(hash.length, 64);
    assert.equal(verifyDecisionSignature(payload, hash), true);
    assert.equal(
      verifyDecisionSignature({ ...payload, decision: "REJECTED" }, hash),
      false,
    );
  });
});

describe("waiting / SLA", () => {
  it("formats durations and classifies SLA", () => {
    assert.match(formatWaitingDuration(90_000), /minute/);
    assert.match(formatWaitingDuration(3_600_000), /hour/);
    assert.match(formatWaitingDuration(90_000_000), /day/);
    const now = new Date("2026-07-14T12:00:00Z");
    assert.equal(
      classifySla({
        dueAt: "2026-07-14T11:00:00Z",
        waitingSince: "2026-07-14T08:00:00Z",
        now,
      }),
      "Overdue",
    );
    assert.equal(isOverdue("2026-07-14T11:00:00Z", now), true);
    assert.equal(isOverdue("2026-07-15T11:00:00Z", now), false);
  });
});

describe("sanitize", () => {
  it("strips html and enforces non-empty titles", () => {
    assert.equal(sanitizeCommentBody("<script>x</script>hello"), "hello");
    assert.equal(sanitizeTitle("  Parts Order  "), "Parts Order");
  });
});

describe("authorization", () => {
  it("scopes visibility by org and assignment", () => {
    assert.equal(
      canViewApproval(adminActor, {
        organizationId: "org-sfx",
        requesterUserId: "other",
        assignedApproverUserId: null,
        status: "PENDING",
      }),
      true,
    );
    assert.equal(
      canViewApproval(techActor, {
        organizationId: "org-sfx",
        requesterUserId: "tech-1",
        assignedApproverUserId: null,
        status: "PENDING",
      }),
      true,
    );
    assert.equal(
      canViewApproval(techActor, {
        organizationId: "org-sfx",
        requesterUserId: "other",
        assignedApproverUserId: "someone-else",
        status: "PENDING",
      }),
      false,
    );
    assert.equal(
      canViewApproval(techActor, {
        organizationId: "other-org",
        requesterUserId: "tech-1",
        assignedApproverUserId: null,
        status: "PENDING",
      }),
      false,
    );
  });

  it("blocks approve on inactive steps and missing permission", () => {
    assert.equal(
      canActOnStep(techActor, {
        assignedUserId: null,
        requiredPermission: "APPROVE_REQUEST",
        status: "ACTIVE",
      }),
      false,
    );
    assert.equal(
      canActOnStep(adminActor, {
        assignedUserId: null,
        requiredPermission: "APPROVE_REQUEST",
        status: "WAITING",
      }),
      false,
    );
    assert.equal(
      canActOnStep(adminActor, {
        assignedUserId: null,
        requiredPermission: "APPROVE_REQUEST",
        status: "ACTIVE",
      }),
      true,
    );
    assert.equal(isClosedStatus("COMPLETED"), true);
    assert.equal(isClosedStatus("PENDING"), false);
  });
});

describe("approval type registry", () => {
  it("registers extensible types without switch edits", () => {
    registerApprovalType({
      type: "CUSTOM_MODULE_REQUEST",
      label: "Custom Module",
      sourceModule: "custom",
      fields: ["businessJustification"],
    });
    assert.equal(getApprovalType("CUSTOM_MODULE_REQUEST")?.label, "Custom Module");
  });
});
