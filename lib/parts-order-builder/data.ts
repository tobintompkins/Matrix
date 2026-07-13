import type {
  AssemblySection,
  DiagramCallout,
  OrderPriority,
  PrinterModel,
  SelectedPartLine,
  ShippingMethod,
  StockStatus,
} from "./types";

export const printerModels: PrinterModel[] = ["GD9630", "GL9730", "Valezus"];

export const assemblySections: AssemblySection[] = [
  "Feed Unit",
  "Registration",
  "Sensors",
  "Rollers",
  "Transport",
  "Exit Area",
];

export const priorities: OrderPriority[] = [
  "Low",
  "Normal",
  "High",
  "Critical",
];

export const shippingMethods: ShippingMethod[] = [
  "Standard Ground",
  "Next Day Air",
  "Will Call",
  "Technician Van",
];

export const customers = [
  "SFX / MPX",
  "Northstar Print Group",
  "Metro Document Services",
];

export const serviceTickets = [
  "TKT-2026-0142",
  "TKT-2026-0138",
  "TKT-2026-0135",
  "TKT-2026-0119",
];

export const serialNumbers: Record<PrinterModel, string[]> = {
  GD9630: ["GD9630-SN-88421", "GD9630-SN-77209"],
  GL9730: ["GL9730-SN-44102", "GL9730-SN-33817"],
  Valezus: ["VAL-SN-22018", "VAL-SN-19544"],
};

export const diagramCallouts: Record<
  PrinterModel,
  Record<AssemblySection, DiagramCallout[]>
> = {
  GD9630: {
    "Feed Unit": [
      {
        calloutNumber: "12",
        partNumber: "RIS-GD-FU-1201",
        partName: "Feed Tray Roller",
        inStock: 4,
        reorderLevel: 2,
      },
      {
        calloutNumber: "13",
        partNumber: "RIS-GD-FU-1202",
        partName: "Separation Pad Assembly",
        inStock: 1,
        reorderLevel: 3,
      },
    ],
    Registration: [
      {
        calloutNumber: "24",
        partNumber: "RIS-GD-RR-2401",
        partName: "Registration Roller",
        inStock: 3,
        reorderLevel: 2,
      },
      {
        calloutNumber: "25",
        partNumber: "RIS-GD-RR-2402",
        partName: "Side Guide Assembly",
        inStock: 0,
        reorderLevel: 2,
      },
    ],
    Sensors: [
      {
        calloutNumber: "31",
        partNumber: "RIS-GD-SN-3101",
        partName: "Paper Path Sensor",
        inStock: 6,
        reorderLevel: 4,
      },
      {
        calloutNumber: "32",
        partNumber: "RIS-GD-SN-3102",
        partName: "Stack Height Sensor",
        inStock: 2,
        reorderLevel: 3,
      },
    ],
    Rollers: [
      {
        calloutNumber: "41",
        partNumber: "RIS-GD-RL-4101",
        partName: "Transport Roller Set",
        inStock: 2,
        reorderLevel: 2,
      },
      {
        calloutNumber: "42",
        partNumber: "RIS-GD-RL-4102",
        partName: "Pressure Roller",
        inStock: 1,
        reorderLevel: 2,
      },
    ],
    Transport: [
      {
        calloutNumber: "51",
        partNumber: "RIS-GD-TR-5101",
        partName: "Drive Belt",
        inStock: 5,
        reorderLevel: 3,
      },
      {
        calloutNumber: "52",
        partNumber: "RIS-GD-TR-5102",
        partName: "Timing Pulley",
        inStock: 0,
        reorderLevel: 1,
      },
    ],
    "Exit Area": [
      {
        calloutNumber: "61",
        partNumber: "RIS-GD-EX-6101",
        partName: "Exit Roller",
        inStock: 3,
        reorderLevel: 2,
      },
      {
        calloutNumber: "62",
        partNumber: "RIS-GD-EX-6102",
        partName: "Output Tray Sensor",
        inStock: 1,
        reorderLevel: 2,
      },
    ],
  },
  GL9730: {
    "Feed Unit": [
      {
        calloutNumber: "11",
        partNumber: "RIS-GL-FU-1101",
        partName: "Feed Clutch Assembly",
        inStock: 2,
        reorderLevel: 2,
      },
      {
        calloutNumber: "12",
        partNumber: "RIS-GL-FU-1102",
        partName: "Pickup Roller",
        inStock: 1,
        reorderLevel: 3,
      },
    ],
    Registration: [
      {
        calloutNumber: "21",
        partNumber: "RIS-GL-RR-2101",
        partName: "Registration Sensor Board",
        inStock: 0,
        reorderLevel: 1,
      },
      {
        calloutNumber: "22",
        partNumber: "RIS-GL-RR-2102",
        partName: "Alignment Roller",
        inStock: 4,
        reorderLevel: 2,
      },
    ],
    Sensors: [
      {
        calloutNumber: "31",
        partNumber: "RIS-GL-SN-3101",
        partName: "Jam Detection Sensor",
        inStock: 3,
        reorderLevel: 2,
      },
    ],
    Rollers: [
      {
        calloutNumber: "41",
        partNumber: "RIS-GL-RL-4101",
        partName: "Fuser Pressure Roller",
        inStock: 1,
        reorderLevel: 2,
      },
    ],
    Transport: [
      {
        calloutNumber: "51",
        partNumber: "RIS-GL-TR-5101",
        partName: "Transfer Belt",
        inStock: 0,
        reorderLevel: 1,
      },
    ],
    "Exit Area": [
      {
        calloutNumber: "61",
        partNumber: "RIS-GL-EX-6101",
        partName: "Stapler Exit Guide",
        inStock: 2,
        reorderLevel: 1,
      },
    ],
  },
  Valezus: {
    "Feed Unit": [
      {
        calloutNumber: "10",
        partNumber: "RIS-VA-FU-1001",
        partName: "Tray Lift Motor",
        inStock: 1,
        reorderLevel: 1,
      },
    ],
    Registration: [
      {
        calloutNumber: "20",
        partNumber: "RIS-VA-RR-2001",
        partName: "Registration Unit",
        inStock: 2,
        reorderLevel: 2,
      },
    ],
    Sensors: [
      {
        calloutNumber: "30",
        partNumber: "RIS-VA-SN-3001",
        partName: "Optical Density Sensor",
        inStock: 0,
        reorderLevel: 2,
      },
    ],
    Rollers: [
      {
        calloutNumber: "40",
        partNumber: "RIS-VA-RL-4001",
        partName: "Drum Cleaning Roller",
        inStock: 3,
        reorderLevel: 2,
      },
    ],
    Transport: [
      {
        calloutNumber: "50",
        partNumber: "RIS-VA-TR-5001",
        partName: "Belt Tensioner",
        inStock: 1,
        reorderLevel: 2,
      },
    ],
    "Exit Area": [
      {
        calloutNumber: "60",
        partNumber: "RIS-VA-EX-6001",
        partName: "Finisher Exit Roller",
        inStock: 2,
        reorderLevel: 2,
      },
    ],
  },
};

export function createInitialSelectedParts(): SelectedPartLine[] {
  return [
    {
      id: "line-1",
      calloutNumber: "13",
      partNumber: "RIS-GD-FU-1202",
      description: "Separation Pad Assembly",
      quantityNeeded: 2,
      inStock: 1,
      orderQuantity: 1,
      reason: "Worn during service call",
    },
    {
      id: "line-2",
      calloutNumber: "31",
      partNumber: "RIS-GD-SN-3101",
      description: "Paper Path Sensor",
      quantityNeeded: 1,
      inStock: 6,
      orderQuantity: 0,
      reason: "Fault code E-2041",
    },
    {
      id: "line-3",
      calloutNumber: "52",
      partNumber: "RIS-GD-TR-5102",
      description: "Timing Pulley",
      quantityNeeded: 1,
      inStock: 0,
      orderQuantity: 1,
      reason: "Broken during transport repair",
    },
  ];
}

export function getStockStatus(
  quantityNeeded: number,
  inStock: number,
  reorderLevel: number,
): StockStatus {
  if (inStock >= quantityNeeded) return "available";
  if (inStock > 0 || inStock >= reorderLevel) return "low";
  return "needs-order";
}

export function getSuggestedOrderQuantity(
  quantityNeeded: number,
  inStock: number,
): number {
  const shortfall = quantityNeeded - inStock;
  return shortfall > 0 ? shortfall : 0;
}

export function getCalloutsForSelection(
  model: PrinterModel,
  assembly: AssemblySection,
): DiagramCallout[] {
  return diagramCallouts[model][assembly];
}
