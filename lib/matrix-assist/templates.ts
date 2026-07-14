/**
 * Seeded generic troubleshooting templates (not manufacturer-official procedures).
 */

import type { SymptomCategory } from "./types";

export type TemplateSeed = {
  printerModel?: string;
  machineFamily?: string;
  symptomCategory: SymptomCategory;
  errorCode?: string;
  assembly?: string;
  title: string;
  safetyNotes: string;
  steps: Array<{ title: string; instructions: string }>;
  relatedParts: Array<{ partNumber: string; description: string }>;
};

export const GENERIC_TROUBLESHOOTING_TEMPLATES: TemplateSeed[] = [
  {
    symptomCategory: "Paper Feed",
    assembly: "Paper Feed Unit",
    title: "General paper feed troubleshooting",
    safetyNotes:
      "Power down before accessing rollers. Do not bypass feed interlocks.",
    steps: [
      {
        title: "Identify tray and media",
        instructions: "Confirm tray, paper size, weight, and condition.",
      },
      {
        title: "Inspect feed rollers",
        instructions: "Look for glazing, dust, wear, or oil contamination.",
      },
      {
        title: "Check separation pad / retard",
        instructions: "Inspect for wear and correct seating.",
      },
      {
        title: "Test feed",
        instructions: "Run a controlled feed test after cleaning or adjustment.",
      },
    ],
    relatedParts: [
      { partNumber: "FEED-ROLL-KIT", description: "Feed roller kit (generic)" },
    ],
  },
  {
    symptomCategory: "Paper Jam",
    assembly: "Paper Path",
    title: "General paper jam troubleshooting",
    safetyNotes:
      "Allow fuser/hot areas to cool. Confirm moving assemblies have stopped.",
    steps: [
      {
        title: "Locate jam area",
        instructions: "Note sensor or panel indication for jam location.",
      },
      {
        title: "Clear media carefully",
        instructions: "Remove all scraps; avoid tearing into sensors.",
      },
      {
        title: "Inspect guides and sensors",
        instructions: "Check for debris, bent guides, or blocked sensors.",
      },
      {
        title: "Verify recovery",
        instructions: "Reset and run test pages from the affected path.",
      },
    ],
    relatedParts: [],
  },
  {
    symptomCategory: "Print Quality",
    title: "General print-quality troubleshooting",
    safetyNotes: "Use PPE when handling ink/toner-related components.",
    steps: [
      {
        title: "Capture sample",
        instructions: "Note defect pattern, color, and whether duplex-only.",
      },
      {
        title: "Review recent maintenance",
        instructions: "Check drum/ink/PM history relevant to the defect.",
      },
      {
        title: "Run diagnostics prints",
        instructions: "Use device test patterns when available.",
      },
    ],
    relatedParts: [],
  },
  {
    symptomCategory: "Error Code",
    title: "General error-code response",
    safetyNotes:
      "Do not bypass safety systems to clear an error. Power-cycle only when safe.",
    steps: [
      {
        title: "Record exact code",
        instructions: "Capture full code text and when it appears.",
      },
      {
        title: "Restart safely",
        instructions: "Power down, wait, restart; note if code returns.",
      },
      {
        title: "Correlate history",
        instructions: "Search prior service calls with the same code/model.",
      },
    ],
    relatedParts: [],
  },
  {
    printerModel: "GD9630",
    machineFamily: "GD",
    symptomCategory: "Paper Feed",
    assembly: "Paper Feed Unit",
    title: "GD9630 feed path — general guidance",
    safetyNotes:
      "No verified manufacturer procedure is embedded. Follow approved RISO/service docs when available.",
    steps: [
      {
        title: "Confirm GD tray source",
        instructions: "Identify Tray 1/2 and media settings on GD9630.",
      },
      {
        title: "Inspect GD feed rollers",
        instructions: "Check roller condition and contamination.",
      },
    ],
    relatedParts: [
      { partNumber: "GD-FEED-ROLL", description: "GD feed roller (placeholder SKU)" },
    ],
  },
];

export function matchTemplates(input: {
  symptomCategory?: string | null;
  printerModel?: string | null;
  errorCode?: string | null;
}): TemplateSeed[] {
  const category = (input.symptomCategory ?? "").toLowerCase();
  const model = (input.printerModel ?? "").toLowerCase();
  const code = (input.errorCode ?? "").toLowerCase();

  return GENERIC_TROUBLESHOOTING_TEMPLATES.filter((t) => {
    if (code && t.errorCode && t.errorCode.toLowerCase() === code) return true;
    if (category && t.symptomCategory.toLowerCase() === category) {
      if (!t.printerModel) return true;
      if (model && t.printerModel.toLowerCase() === model) return true;
      return !model;
    }
    if (model && t.printerModel?.toLowerCase() === model) return true;
    return false;
  }).slice(0, 5);
}
