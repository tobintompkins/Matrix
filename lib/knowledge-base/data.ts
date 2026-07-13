import type { ModelKnowledge, PrinterModelId } from "./types";

export const modelKnowledge: Record<PrinterModelId, ModelKnowledge> = {
  GD9630: {
    id: "GD9630",
    deviceType: "High-volume digital duplicator / production printer",
    supportedWorkflows: [
      "High-volume mono production",
      "Mail / fulfillment runs",
      "Preventive maintenance",
      "Break/fix field service",
    ],
    pmInterval: "Every 300,000 impressions or quarterly (placeholder)",
    commonServiceAreas: [
      "Tray feed path",
      "Separation pads",
      "Registration section",
      "Sensors / paper path",
      "Drive belts",
    ],
    commonIssues: [
      {
        issue: "Tray 2 jams",
        symptoms: "Frequent jams at feed roller during high-volume runs",
        likelyArea: "Feed path / Tray 2",
        firstChecks: "Inspect feed rollers, pads, tray guides, media type",
      },
      {
        issue: "Black marks on sheet edge",
        symptoms: "Marks on leading edge, especially light coverage jobs",
        likelyArea: "Drum / cleaning blade / transfer path",
        firstChecks: "Inspect drum surface, cleaning blade, paper path debris",
      },
      {
        issue: "Registration alignment issue",
        symptoms: "Image shift on duplex or front/back mismatch",
        likelyArea: "Registration / transport",
        firstChecks: "Check registration rollers, sensors, calibration",
      },
      {
        issue: "Multi-feed condition",
        symptoms: "Multiple sheets pulled; feed errors",
        likelyArea: "Separation pads / pickup rollers",
        firstChecks: "Replace pads, inspect rollers, verify paper humidity",
      },
      {
        issue: "Sensor-related stop",
        symptoms: "Unexpected stop; paper position or jam sensor fault",
        likelyArea: "Sensors",
        firstChecks: "Clean sensors, verify wiring, clear path debris",
      },
    ],
    pmKitParts: [
      "Recommended PM kit: PM-KIT-GD9630",
      "Feed rollers",
      "Registration rollers",
      "Sensors (feed / registration)",
      "Separation pads",
      "Belts",
      "Cleaning supplies",
    ],
  },
  GL9730: {
    id: "GL9730",
    deviceType: "Production color / graphics output printer",
    supportedWorkflows: [
      "Color production",
      "Duplex registration-critical jobs",
      "Preventive maintenance",
      "Warranty / break-fix service",
    ],
    pmInterval: "Every 250,000 impressions or quarterly (placeholder)",
    commonServiceAreas: [
      "Registration / duplex path",
      "Color / process units",
      "Feed / LCT pickup",
      "Sensors",
      "Belts and drive",
    ],
    commonIssues: [
      {
        issue: "Tray 2 jams",
        symptoms: "Jams during pickup from secondary or LCT trays",
        likelyArea: "Feed / LCT",
        firstChecks: "Inspect pickup rollers, pads, tray sensors",
      },
      {
        issue: "Black marks on sheet edge",
        symptoms: "Edge marking on light coverage or solid areas",
        likelyArea: "Drum / cleaning / transfer",
        firstChecks: "Inspect process unit, cleaning blade, media path",
      },
      {
        issue: "Registration alignment issue",
        symptoms: "1mm+ duplex image shift; single-side OK",
        likelyArea: "Registration / duplex unit",
        firstChecks: "Calibrate registration, inspect rollers and sensors",
      },
      {
        issue: "Multi-feed condition",
        symptoms: "Double feeds; skewed sheets entering path",
        likelyArea: "Separation / pickup",
        firstChecks: "Replace pads, clean rollers, check paper stock",
      },
      {
        issue: "Sensor-related stop",
        symptoms: "Intermittent stop; feed sensor or registration fault",
        likelyArea: "Upper tray / registration sensors",
        firstChecks: "Clean sensors, reseat connectors, verify cable routing",
      },
    ],
    pmKitParts: [
      "Recommended PM kit: PM-KIT-GL9730",
      "Feed rollers",
      "Registration rollers",
      "Sensors",
      "Separation pads",
      "Belts",
      "Cleaning supplies",
    ],
  },
  Valezus: {
    id: "Valezus",
    deviceType: "Graphic arts / design studio color printer",
    supportedWorkflows: [
      "Design / creative output",
      "Short to mid-run color",
      "Image quality diagnostics",
      "Preventive maintenance",
    ],
    pmInterval: "Every 150,000 impressions or bi-annual (placeholder)",
    commonServiceAreas: [
      "Image quality / drum",
      "Bypass and tray feed",
      "Registration",
      "Sensors",
      "Main transport belt",
    ],
    commonIssues: [
      {
        issue: "Tray 2 jams",
        symptoms: "Jams from secondary tray under mixed media",
        likelyArea: "Feed path",
        firstChecks: "Inspect rollers, pads, tray alignment",
      },
      {
        issue: "Black marks on sheet edge",
        symptoms: "Consistent black marks on sheet leading edge",
        likelyArea: "Drum / cleaning blade",
        firstChecks: "Inspect drum, cleaning blade, transfer path",
      },
      {
        issue: "Registration alignment issue",
        symptoms: "Color registration drift after media change",
        likelyArea: "Registration / color alignment",
        firstChecks: "Run color registration check, inspect sensors/rollers",
      },
      {
        issue: "Multi-feed condition",
        symptoms: "Bypass or tray multi-feeds on coated stock",
        likelyArea: "Separation pads",
        firstChecks: "Replace bypass pad, clean pickup rollers",
      },
      {
        issue: "Sensor-related stop",
        symptoms: "Unexpected halt; paper detect or exit sensor",
        likelyArea: "Sensors",
        firstChecks: "Clean sensors, clear residual media, cycle power",
      },
    ],
    pmKitParts: [
      "Recommended PM kit: PM-KIT-VAL",
      "Feed rollers",
      "Registration rollers",
      "Sensors",
      "Separation pads",
      "Belts",
      "Cleaning supplies",
    ],
  },
};

export const modelIds: PrinterModelId[] = ["GD9630", "GL9730", "Valezus"];

export const serviceReferences = [
  {
    id: "manual",
    title: "Service Manual",
    description: "Full model service documentation (placeholder).",
  },
  {
    id: "pm",
    title: "PM Procedure",
    description: "Step-by-step preventive maintenance guide (placeholder).",
  },
  {
    id: "errors",
    title: "Error Code Guide",
    description: "Series-scoped error codes and remedies (placeholder).",
  },
  {
    id: "firmware",
    title: "Firmware Notes",
    description: "Firmware versions and update notes (placeholder).",
  },
  {
    id: "bulletins",
    title: "Service Bulletins",
    description: "Technical bulletins and field advisories (placeholder).",
  },
];
