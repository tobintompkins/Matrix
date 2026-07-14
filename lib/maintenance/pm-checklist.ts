/**
 * Patch 46 — PM checklist templates & runtime item helpers.
 * Per printer-model checklists; technicians complete/skip with reasons.
 */

export type PmWorkflowChecklistStatus = "PENDING" | "DONE" | "SKIPPED";

export type PmWorkflowChecklistItem = {
  id: string;
  itemKey: string;
  taskName: string;
  description: string;
  required: boolean;
  sortOrder: number;
  status: PmWorkflowChecklistStatus;
  notes: string;
  skipReason: string;
};

export type PmPartUsed = {
  /** Existing inventory catalog part id when looked up / selected. */
  partId?: string | null;
  partNumber: string;
  description: string;
  quantity: number;
};

/** Default checklist items (Patch 46 addendum). */
export const DEFAULT_PM_CHECKLIST_DEFS: Array<{
  itemKey: string;
  taskName: string;
  description: string;
  required: boolean;
  sortOrder: number;
}> = [
  {
    itemKey: "clean-imaging-unit",
    taskName: "Clean imaging unit",
    description: "Clean imaging unit and remove residue",
    required: true,
    sortOrder: 10,
  },
  {
    itemKey: "clean-paper-path",
    taskName: "Clean paper path",
    description: "Clear and wipe paper path",
    required: true,
    sortOrder: 20,
  },
  {
    itemKey: "vacuum-machine",
    taskName: "Vacuum machine",
    description: "Vacuum internal dust and toner",
    required: true,
    sortOrder: 30,
  },
  {
    itemKey: "inspect-rollers",
    taskName: "Inspect rollers",
    description: "Inspect rollers for wear and contamination",
    required: true,
    sortOrder: 40,
  },
  {
    itemKey: "inspect-feed-tires",
    taskName: "Inspect feed tires",
    description: "Inspect feed tires for wear and glazing",
    required: true,
    sortOrder: 50,
  },
  {
    itemKey: "clean-sensors",
    taskName: "Clean sensors",
    description: "Clean optical and paper sensors",
    required: true,
    sortOrder: 60,
  },
  {
    itemKey: "inspect-drums",
    taskName: "Inspect drums",
    description: "Inspect drum units for damage",
    required: true,
    sortOrder: 70,
  },
  {
    itemKey: "inspect-fuser",
    taskName: "Inspect fuser",
    description: "Inspect fuser assembly",
    required: false,
    sortOrder: 80,
  },
  {
    itemKey: "check-firmware",
    taskName: "Check firmware version",
    description: "Record and verify firmware version",
    required: false,
    sortOrder: 90,
  },
  {
    itemKey: "verify-print-quality",
    taskName: "Verify print quality",
    description: "Review print quality samples",
    required: true,
    sortOrder: 100,
  },
  {
    itemKey: "test-copy",
    taskName: "Test copy",
    description: "Run a test copy / print verification",
    required: true,
    sortOrder: 110,
  },
  {
    itemKey: "final-inspection",
    taskName: "Final inspection",
    description: "Final walkthrough and close-out",
    required: true,
    sortOrder: 120,
  },
];

/** Legacy keys deactivated when aligning to the Patch 46 addendum. */
export const DEPRECATED_PM_CHECKLIST_KEYS = [
  "inspect-feed-rollers",
  "inspect-separation-rollers",
  "run-test-prints",
] as const;

export function buildChecklistFromDefs(
  defs: typeof DEFAULT_PM_CHECKLIST_DEFS,
): PmWorkflowChecklistItem[] {
  return defs.map((d) => ({
    id: d.itemKey,
    itemKey: d.itemKey,
    taskName: d.taskName,
    description: d.description,
    required: d.required,
    sortOrder: d.sortOrder,
    status: "PENDING" as const,
    notes: "",
    skipReason: "",
  }));
}

export function validateChecklistForCompletion(
  items: PmWorkflowChecklistItem[],
): { ok: true } | { ok: false; error: string } {
  for (const item of items) {
    if (item.status === "PENDING" && item.required) {
      return {
        ok: false,
        error: `Required checklist item still pending: ${item.taskName}`,
      };
    }
    if (item.status === "SKIPPED" && !item.skipReason.trim()) {
      return {
        ok: false,
        error: `Skip reason required for: ${item.taskName}`,
      };
    }
  }
  return { ok: true };
}

export function checklistCompletionPercent(
  items: PmWorkflowChecklistItem[],
): number {
  if (items.length === 0) return 100;
  const done = items.filter((i) => i.status === "DONE").length;
  return Math.round((done / items.length) * 1000) / 10;
}

export function calculateLaborMinutes(
  timeStarted: Date | string | null | undefined,
  timeFinished: Date | string | null | undefined,
): number | null {
  if (!timeStarted || !timeFinished) return null;
  const start = new Date(timeStarted).getTime();
  const end = new Date(timeFinished).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function validatePmTimeRange(
  timeStarted: Date | string | null | undefined,
  timeFinished: Date | string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (!timeStarted || !timeFinished) {
    return { ok: false, error: "Time started and time finished are required." };
  }
  const start = new Date(timeStarted).getTime();
  const end = new Date(timeFinished).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, error: "Time started and time finished must be valid." };
  }
  if (end < start) {
    return {
      ok: false,
      error: "Finish time cannot be earlier than start time.",
    };
  }
  return { ok: true };
}
