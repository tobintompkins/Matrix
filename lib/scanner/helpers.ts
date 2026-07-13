import {
  sampleDiagramCallouts,
  sampleParts,
  samplePrinters,
} from "./data";
import type {
  ScanLookupResult,
  ScanLookupType,
  ScannerAction,
  ScannerHistoryItem,
  ScannedPartResult,
} from "./types";

export function normalizeScanQuery(value: string): string {
  return value.trim().toUpperCase();
}

/** Detect whether entered value looks like a part, serial, asset, or callout. */
export function detectLookupType(raw: string): ScanLookupType {
  const value = normalizeScanQuery(raw);
  if (!value) return "unknown";

  // Asset tags: MX-GD-002, MX-T22-001
  if (/^MX-[A-Z0-9]+-\d+$/i.test(value)) return "printer-asset";

  // Serial numbers: GD9630-SN-88421, VAL-SN-22018, T2200-SN-11001
  if (/-SN-/i.test(value) || /^[A-Z0-9]+-SN-\d+$/i.test(value)) {
    return "serial";
  }

  // Diagram callouts: GD9630-FU-12, VAL-INK-03, T2200-FU-05
  if (
    /^(GD9630|GL9730|VAL|VALEZUS|T2200|T2100)-[A-Z]+-\d+$/i.test(value) ||
    /^CALLOUT[-:]?\d+$/i.test(value)
  ) {
    return "diagram-callout";
  }

  // Part numbers: RIS-GD-FR-2201
  if (/^RIS-/i.test(value) || /^[A-Z]{2,4}-[A-Z0-9]+-[A-Z0-9]+-\d+$/i.test(value)) {
    return "part";
  }

  // Numeric-only often treated as callout attempt
  if (/^\d{1,3}$/.test(value)) return "diagram-callout";

  return "unknown";
}

function partActions(): ScannerAction[] {
  return [
    {
      id: "add-to-parts-order",
      label: "Add to Parts Order",
      href: "/parts-order-builder",
      variant: "primary",
    },
    {
      id: "view-inventory",
      label: "View Inventory",
      href: "/inventory",
      variant: "secondary",
    },
    {
      id: "open-diagram",
      label: "Open Diagram",
      href: "/guided-diagram-ordering",
      variant: "secondary",
    },
    {
      id: "view-service-history",
      label: "View Service History",
      href: "/tickets",
      variant: "secondary",
    },
  ];
}

function printerActions(machineId: string): ScannerAction[] {
  return [
    {
      id: "open-digital-twin",
      label: "Open Digital Twin",
      href: `/digital-twin/${machineId}`,
      variant: "primary",
    },
    {
      id: "view-service-history",
      label: "View Service History",
      href: "/tickets",
      variant: "secondary",
    },
    {
      id: "view-inventory",
      label: "View Inventory",
      href: "/inventory",
      variant: "secondary",
    },
    {
      id: "open-diagram",
      label: "Open Diagram",
      href: "/guided-diagram-ordering",
      variant: "secondary",
    },
  ];
}

function diagramActions(): ScannerAction[] {
  return [
    {
      id: "open-diagram",
      label: "Open Diagram",
      href: "/guided-diagram-ordering",
      variant: "primary",
    },
    {
      id: "add-to-parts-order",
      label: "Add to Parts Order",
      href: "/parts-order-builder",
      variant: "secondary",
    },
    {
      id: "view-inventory",
      label: "View Inventory",
      href: "/inventory",
      variant: "secondary",
    },
  ];
}

export function lookupScanValue(raw: string): ScanLookupResult {
  const query = raw.trim();
  const normalized = normalizeScanQuery(query);
  const detectedType = detectLookupType(query);

  if (!normalized) {
    return {
      found: false,
      query,
      detectedType: "unknown",
      message: "Enter a barcode, QR value, part number, asset ID, or serial.",
    };
  }

  // Try exact matches across catalogs regardless of detected type
  const part = sampleParts.find(
    (p) => normalizeScanQuery(p.partNumber) === normalized,
  );
  if (part) {
    return {
      found: true,
      query,
      detectedType: "part",
      result: part,
      actions: partActions(),
    };
  }

  const printerByAsset = samplePrinters.find(
    (p) => normalizeScanQuery(p.assetId) === normalized,
  );
  if (printerByAsset) {
    return {
      found: true,
      query,
      detectedType: "printer-asset",
      result: printerByAsset,
      actions: printerActions(printerByAsset.assetId),
    };
  }

  const printerBySerial = samplePrinters.find(
    (p) => normalizeScanQuery(p.serialNumber) === normalized,
  );
  if (printerBySerial) {
    return {
      found: true,
      query,
      detectedType: "serial",
      result: printerBySerial,
      actions: printerActions(printerBySerial.assetId),
    };
  }

  const callout = sampleDiagramCallouts.find(
    (c) =>
      normalizeScanQuery(c.calloutCode) === normalized ||
      normalizeScanQuery(c.calloutNumber) === normalized,
  );
  if (callout) {
    return {
      found: true,
      query,
      detectedType: "diagram-callout",
      result: callout,
      actions: diagramActions(),
    };
  }

  const typeLabel =
    detectedType === "part"
      ? "part number"
      : detectedType === "printer-asset"
        ? "asset ID"
        : detectedType === "serial"
          ? "serial number"
          : detectedType === "diagram-callout"
            ? "diagram callout"
            : "code";

  return {
    found: false,
    query,
    detectedType,
    message: `No match found for “${query}” (detected as ${typeLabel}). Try a sample part, asset ID, serial, or callout.`,
  };
}

export function createHistoryItem(
  lookup: ScanLookupResult,
): ScannerHistoryItem {
  let label = lookup.query;
  if (lookup.found) {
    const result = lookup.result;
    if (result.kind === "part") label = `${result.partNumber} — ${result.description}`;
    if (result.kind === "printer") {
      label = `${result.assetId} — ${result.model}`;
    }
    if (result.kind === "diagram-callout") {
      label = `${result.calloutCode} — ${result.partName}`;
    }
  }

  return {
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    query: lookup.query,
    detectedType: lookup.detectedType,
    label,
    found: lookup.found,
    scannedAt: new Date().toISOString(),
  };
}

export function partResultToOrderDraft(part: ScannedPartResult) {
  return {
    id: `scan-pod-${part.partNumber}-${Date.now()}`,
    partNumber: part.partNumber,
    description: part.description,
    quantity: Math.max(1, part.inventoryStatus === "Out of Stock" ? 2 : 1),
    compatibleModels: part.compatibleModels,
    reason:
      part.inventoryStatus === "Out of Stock"
        ? ("out-of-stock" as const)
        : part.inventoryStatus === "Low Stock"
          ? ("low-stock" as const)
          : ("manual" as const),
  };
}
