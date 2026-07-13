import type { MaintenanceIntervalConfig } from "./types";

/**
 * Centralized, editable maintenance interval defaults per printer model.
 * Labeled as setup values — change here (or via updateIntervalConfig) rather
 * than hard-coding inside UI components.
 *
 * Temporary defaults (editable):
 * - PM / Joint / DTF: 1,000,000 copies
 * - Cleaning: 250,000 copies
 * - Warning threshold: 100,000 copies before due
 */

export const DEFAULT_WARNING_THRESHOLD = 100_000;
export const DEFAULT_PM_INTERVAL = 1_000_000;
export const DEFAULT_CLEANING_INTERVAL = 250_000;
export const DEFAULT_JOINT_UNIT_INTERVAL = 1_000_000;
export const DEFAULT_DTF_PM_INTERVAL = 1_000_000;

const SETUP_NOTE =
  "Editable setup defaults (Patch 34). Adjust per model as real intervals are confirmed.";

/** Seed interval catalog — model-specific (do not assume identical intervals). */
export const defaultMaintenanceIntervals: MaintenanceIntervalConfig[] = [
  {
    printerModel: "GD9630",
    pmInterval: DEFAULT_PM_INTERVAL,
    cleaningInterval: DEFAULT_CLEANING_INTERVAL,
    jointUnitInterval: DEFAULT_JOINT_UNIT_INTERVAL,
    dtfPmInterval: DEFAULT_DTF_PM_INTERVAL,
    warningThreshold: DEFAULT_WARNING_THRESHOLD,
    notes: SETUP_NOTE,
  },
  {
    printerModel: "GL9730",
    pmInterval: 800_000,
    cleaningInterval: 200_000,
    jointUnitInterval: 800_000,
    dtfPmInterval: 800_000,
    warningThreshold: 80_000,
    notes: `${SETUP_NOTE} GL9730 uses slightly tighter intervals than GD9630.`,
  },
  {
    printerModel: "Valezus",
    pmInterval: 1_200_000,
    cleaningInterval: 300_000,
    jointUnitInterval: 1_200_000,
    dtfPmInterval: 600_000,
    warningThreshold: 120_000,
    notes: `${SETUP_NOTE} Valezus T2100/T2200 share this model key; DTF interval is shorter.`,
  },
  {
    printerModel: "T2200",
    pmInterval: 1_200_000,
    cleaningInterval: 300_000,
    jointUnitInterval: 1_200_000,
    dtfPmInterval: 600_000,
    warningThreshold: 120_000,
    notes: SETUP_NOTE,
  },
  {
    printerModel: "T2100",
    pmInterval: 1_000_000,
    cleaningInterval: 250_000,
    jointUnitInterval: 1_000_000,
    dtfPmInterval: 500_000,
    warningThreshold: 100_000,
    notes: SETUP_NOTE,
  },
];

export function resolvePrinterModelKey(printerModel: string): string {
  const raw = printerModel.trim();
  if (/^valezus/i.test(raw)) return "Valezus";
  if (/t2200/i.test(raw)) return "T2200";
  if (/t2100/i.test(raw)) return "T2100";
  if (/gl9730/i.test(raw)) return "GL9730";
  if (/gd9630/i.test(raw)) return "GD9630";
  return raw;
}

export function getDefaultIntervalForModel(
  printerModel: string,
): MaintenanceIntervalConfig {
  const key = resolvePrinterModelKey(printerModel);
  const found = defaultMaintenanceIntervals.find((c) => c.printerModel === key);
  if (found) return { ...found };
  return {
    printerModel: key,
    pmInterval: DEFAULT_PM_INTERVAL,
    cleaningInterval: DEFAULT_CLEANING_INTERVAL,
    jointUnitInterval: DEFAULT_JOINT_UNIT_INTERVAL,
    dtfPmInterval: DEFAULT_DTF_PM_INTERVAL,
    warningThreshold: DEFAULT_WARNING_THRESHOLD,
    notes: `${SETUP_NOTE} Fallback defaults for unrecognized model "${printerModel}".`,
  };
}
