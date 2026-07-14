import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChecklistFromDefs,
  calculateLaborMinutes,
  checklistCompletionPercent,
  DEFAULT_PM_CHECKLIST_DEFS,
  validateChecklistForCompletion,
  validatePmTimeRange,
  type PmWorkflowChecklistItem,
} from "./pm-checklist";
import {
  calculatePmQualityScore,
  PM_QUALITY_SCORE_FORMULA,
} from "./pm-quality";

describe("pm-checklist", () => {
  it("builds addendum checklist with required items", () => {
    const items = buildChecklistFromDefs(DEFAULT_PM_CHECKLIST_DEFS);
    assert.equal(items.length, 12);
    assert.ok(items.some((i) => i.taskName === "Clean imaging unit"));
    assert.ok(items.some((i) => i.taskName === "Inspect rollers"));
    assert.ok(items.some((i) => i.taskName === "Inspect feed tires"));
    assert.ok(items.some((i) => i.taskName === "Test copy"));
    assert.ok(items.every((i) => i.status === "PENDING"));
  });

  it("rejects completion when required items are pending", () => {
    const items = buildChecklistFromDefs(DEFAULT_PM_CHECKLIST_DEFS);
    const result = validateChecklistForCompletion(items);
    assert.equal(result.ok, false);
  });

  it("allows completion when required items done and skips have reasons", () => {
    const items = buildChecklistFromDefs(DEFAULT_PM_CHECKLIST_DEFS).map(
      (i): PmWorkflowChecklistItem =>
        i.required
          ? { ...i, status: "DONE" }
          : { ...i, status: "SKIPPED", skipReason: "Not applicable" },
    );
    const result = validateChecklistForCompletion(items);
    assert.equal(result.ok, true);
    assert.ok(checklistCompletionPercent(items) > 0);
  });

  it("rejects skip without reason", () => {
    const items = buildChecklistFromDefs(DEFAULT_PM_CHECKLIST_DEFS).map(
      (i): PmWorkflowChecklistItem =>
        i.required
          ? { ...i, status: "DONE" }
          : { ...i, status: "SKIPPED", skipReason: "" },
    );
    const result = validateChecklistForCompletion(items);
    assert.equal(result.ok, false);
  });

  it("calculates labor minutes from start/finish", () => {
    const mins = calculateLaborMinutes(
      "2026-07-13T10:00:00.000Z",
      "2026-07-13T11:30:00.000Z",
    );
    assert.equal(mins, 90);
  });

  it("rejects finish earlier than start", () => {
    const result = validatePmTimeRange(
      "2026-07-13T12:00:00.000Z",
      "2026-07-13T11:00:00.000Z",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Finish time cannot be earlier/i);
    }
  });
});

describe("pm-quality", () => {
  it("exposes documented formula weights totaling 100", () => {
    const sum = Object.values(PM_QUALITY_SCORE_FORMULA.weights).reduce(
      (a, b) => a + b,
      0,
    );
    assert.equal(sum, 100);
  });

  it("scores a fully documented PM near 100", () => {
    const checklist = buildChecklistFromDefs(DEFAULT_PM_CHECKLIST_DEFS).map(
      (i) => ({ ...i, status: "DONE" as const }),
    );
    const score = calculatePmQualityScore({
      checklist,
      notes: "Completed full PM",
      partsUsed: [
        {
          partId: "part-1",
          partNumber: "S-8224",
          description: "Master",
          quantity: 1,
        },
      ],
      meterRecorded: true,
      laborMinutes: 75,
    });
    assert.ok(score >= 95);
    assert.ok(score <= 100);
  });

  it("penalizes missing required checklist items", () => {
    const checklist = buildChecklistFromDefs(DEFAULT_PM_CHECKLIST_DEFS);
    const score = calculatePmQualityScore({
      checklist,
      notes: "",
      partsUsed: [],
      meterRecorded: false,
      laborMinutes: null,
    });
    assert.ok(score < 40);
  });

  it("does not score note length — only presence", () => {
    const checklist = buildChecklistFromDefs(DEFAULT_PM_CHECKLIST_DEFS).map(
      (i) => ({ ...i, status: "DONE" as const }),
    );
    const short = calculatePmQualityScore({
      checklist,
      notes: "ok",
      partsUsed: [],
      meterRecorded: true,
      laborMinutes: 30,
    });
    const long = calculatePmQualityScore({
      checklist,
      notes: "ok ".repeat(200),
      partsUsed: [],
      meterRecorded: true,
      laborMinutes: 30,
    });
    assert.equal(short, long);
  });
});
