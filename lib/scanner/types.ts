export type ScanLookupType =
  | "part"
  | "printer-asset"
  | "serial"
  | "diagram-callout"
  | "unknown";

export type ScannerActionId =
  | "add-to-parts-order"
  | "view-inventory"
  | "open-diagram"
  | "open-digital-twin"
  | "view-service-history"
  | "clear-lookup"
  | "back-to-dashboard";

export type ScannerAction = {
  id: ScannerActionId;
  label: string;
  href?: string;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger";
};

export type ScannedPartResult = {
  kind: "part";
  partNumber: string;
  description: string;
  compatibleModels: string[];
  inventoryStatus: "In Stock" | "Low Stock" | "Out of Stock";
  quantityOnHand: number;
  locationLabel: string;
  locationType: "truck" | "warehouse";
  diagramName?: string;
  calloutNumber?: string;
  lastServiceNote?: string;
};

export type ScannedPrinterResult = {
  kind: "printer";
  assetId: string;
  model: string;
  serialNumber: string;
  location: string;
  customer: string;
  status: string;
  digitalTwinSlug: string;
  lastServiceDate: string;
  openTicketCount: number;
};

export type ScannedDiagramCalloutResult = {
  kind: "diagram-callout";
  calloutCode: string;
  calloutNumber: string;
  diagramName: string;
  model: string;
  assembly: string;
  partNumber: string;
  partName: string;
};

export type ScanLookupResult =
  | {
      found: true;
      query: string;
      detectedType: ScanLookupType;
      result:
        | ScannedPartResult
        | ScannedPrinterResult
        | ScannedDiagramCalloutResult;
      actions: ScannerAction[];
    }
  | {
      found: false;
      query: string;
      detectedType: ScanLookupType;
      message: string;
    };

export type ScannerHistoryItem = {
  id: string;
  query: string;
  detectedType: ScanLookupType;
  label: string;
  found: boolean;
  scannedAt: string;
};

/** Future integration placeholders — do not wire yet. */
export type ScannerIntegrationPlaceholders = {
  realCameraScanner: "pending";
  mobileBarcodeScanner: "pending";
  qrLabelsOnMachines: "pending";
  inventoryDatabase: "pending";
  serviceHistoryDatabase: "pending";
  digitalTwinProfiles: "pending";
  explodedDiagramDatabase: "pending";
};
