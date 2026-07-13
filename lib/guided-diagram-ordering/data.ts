import type {
  AssemblySection,
  CartLine,
  DiagramCalloutRow,
  InventoryStatus,
  OrderPriority,
  PrinterModel,
} from "./types";

export const printerModels: PrinterModel[] = ["GD9630", "GL9730", "Valezus"];

export const assemblySections: AssemblySection[] = [
  "Feed Unit",
  "Registration",
  "Sensors",
  "Rollers",
  "Transport",
  "Exit Area",
  "Ink / Supply",
  "Duplex / Paper Path",
];

export const priorities: OrderPriority[] = [
  "Low",
  "Normal",
  "High",
  "Critical",
];

export const customers = ["SFX / MPX", "Northstar Print Group"];

export const assetIds: Record<PrinterModel, string[]> = {
  GD9630: ["GD-9630-001", "MX-GD-002"],
  GL9730: ["GL-9730-001", "MX-GL-001"],
  Valezus: ["VAL-001", "MX-VA-002"],
};

export const serialNumbers: Record<PrinterModel, string[]> = {
  GD9630: ["GD9630-SN-001", "GD9630-SN-88421"],
  GL9730: ["GL9730-SN-44102", "GL9730-SN-33817"],
  Valezus: ["VAL-SN-22018", "VAL-SN-19544"],
};

export const serviceTickets = [
  "TCK-1001",
  "TKT-2026-0142",
  "TKT-2026-0138",
  "TKT-2026-0135",
];

function status(inStock: number, needed: number): InventoryStatus {
  if (inStock >= needed) return "In Stock";
  if (inStock > 0) return "Low Stock";
  return "Order Required";
}

export const diagramCallouts: Record<
  PrinterModel,
  Record<AssemblySection, DiagramCalloutRow[]>
> = {
  GD9630: {
    "Feed Unit": [
      {
        calloutNumber: "12",
        partNumber: "RIS-GD-FU-1201",
        partName: "Feed Tray Roller",
        description: "Primary feed roller for Tray 1",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 4,
        inventoryStatus: status(4, 1),
      },
      {
        calloutNumber: "13",
        partNumber: "RIS-GD-FU-1202",
        partName: "Separation Pad Assembly",
        description: "Tray 2 separation pad set",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 1,
        inventoryStatus: status(1, 2),
      },
    ],
    Registration: [
      {
        calloutNumber: "24",
        partNumber: "RIS-GD-RR-2401",
        partName: "Registration Roller",
        description: "Front registration roller assembly",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 3,
        inventoryStatus: status(3, 1),
      },
    ],
    Sensors: [
      {
        calloutNumber: "31",
        partNumber: "RIS-GD-SN-3101",
        partName: "Paper Path Sensor",
        description: "Upper paper path detection sensor",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 6,
        inventoryStatus: status(6, 1),
      },
    ],
    Rollers: [
      {
        calloutNumber: "41",
        partNumber: "RIS-GD-RL-4101",
        partName: "Transport Roller Set",
        description: "Main transport roller kit",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 2,
        inventoryStatus: status(2, 1),
      },
    ],
    Transport: [
      {
        calloutNumber: "51",
        partNumber: "RIS-GD-TR-5101",
        partName: "Drive Belt",
        description: "Main drive timing belt",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 5,
        inventoryStatus: status(5, 1),
      },
    ],
    "Exit Area": [
      {
        calloutNumber: "61",
        partNumber: "RIS-GD-EX-6101",
        partName: "Exit Roller",
        description: "Output stack exit roller",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 3,
        inventoryStatus: status(3, 1),
      },
    ],
    "Ink / Supply": [
      {
        calloutNumber: "71",
        partNumber: "RIS-GD-INK-7101",
        partName: "Ink Supply Unit",
        description: "Process black ink supply module",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 0,
        inventoryStatus: status(0, 1),
      },
    ],
    "Duplex / Paper Path": [
      {
        calloutNumber: "81",
        partNumber: "RIS-GD-DP-8101",
        partName: "Duplex Reversal Guide",
        description: "Duplex unit paper reversal guide",
        quantity: 1,
        compatibleModel: "GD9630",
        inStock: 1,
        inventoryStatus: status(1, 1),
      },
    ],
  },
  GL9730: {
    "Feed Unit": [
      {
        calloutNumber: "11",
        partNumber: "RIS-GL-FU-1101",
        partName: "Feed Clutch Assembly",
        description: "Large capacity tray feed clutch",
        quantity: 1,
        compatibleModel: "GL9730",
        inStock: 2,
        inventoryStatus: status(2, 1),
      },
    ],
    Registration: [
      {
        calloutNumber: "21",
        partNumber: "RIS-GL-RR-2101",
        partName: "Registration Sensor Board",
        description: "Registration sensor PCB assembly",
        quantity: 1,
        compatibleModel: "GL9730",
        inStock: 0,
        inventoryStatus: status(0, 1),
      },
    ],
    Sensors: [
      {
        calloutNumber: "31",
        partNumber: "RIS-GL-SN-3101",
        partName: "Jam Detection Sensor",
        description: "Duplex path jam sensor",
        quantity: 1,
        compatibleModel: "GL9730",
        inStock: 3,
        inventoryStatus: status(3, 1),
      },
    ],
    Rollers: [
      {
        calloutNumber: "41",
        partNumber: "RIS-GL-RL-4101",
        partName: "Fuser Pressure Roller",
        description: "Fuser section pressure roller",
        quantity: 1,
        compatibleModel: "GL9730",
        inStock: 1,
        inventoryStatus: status(1, 1),
      },
    ],
    Transport: [
      {
        calloutNumber: "51",
        partNumber: "RIS-GL-TR-5101",
        partName: "Transfer Belt",
        description: "Image transfer belt assembly",
        quantity: 1,
        compatibleModel: "GL9730",
        inStock: 0,
        inventoryStatus: status(0, 1),
      },
    ],
    "Exit Area": [
      {
        calloutNumber: "61",
        partNumber: "RIS-GL-EX-6101",
        partName: "Stapler Exit Guide",
        description: "Finisher exit path guide",
        quantity: 1,
        compatibleModel: "GL9730",
        inStock: 2,
        inventoryStatus: status(2, 1),
      },
    ],
    "Ink / Supply": [
      {
        calloutNumber: "71",
        partNumber: "RIS-GL-INK-7101",
        partName: "Toner Supply Hopper",
        description: "Process black toner hopper",
        quantity: 1,
        compatibleModel: "GL9730",
        inStock: 2,
        inventoryStatus: status(2, 1),
      },
    ],
    "Duplex / Paper Path": [
      {
        calloutNumber: "81",
        partNumber: "RIS-GL-DP-8101",
        partName: "Duplex Turn Guide",
        description: "Duplex turn registration guide",
        quantity: 1,
        compatibleModel: "GL9730",
        inStock: 1,
        inventoryStatus: status(1, 1),
      },
    ],
  },
  Valezus: {
    "Feed Unit": [
      {
        calloutNumber: "10",
        partNumber: "RIS-VA-FU-1001",
        partName: "Tray Lift Motor",
        description: "Bypass tray lift motor unit",
        quantity: 1,
        compatibleModel: "Valezus",
        inStock: 1,
        inventoryStatus: status(1, 1),
      },
    ],
    Registration: [
      {
        calloutNumber: "20",
        partNumber: "RIS-VA-RR-2001",
        partName: "Registration Unit",
        description: "Full registration assembly",
        quantity: 1,
        compatibleModel: "Valezus",
        inStock: 2,
        inventoryStatus: status(2, 1),
      },
    ],
    Sensors: [
      {
        calloutNumber: "30",
        partNumber: "RIS-VA-SN-3001",
        partName: "Optical Density Sensor",
        description: "Print density calibration sensor",
        quantity: 1,
        compatibleModel: "Valezus",
        inStock: 0,
        inventoryStatus: status(0, 1),
      },
    ],
    Rollers: [
      {
        calloutNumber: "40",
        partNumber: "RIS-VA-RL-4001",
        partName: "Drum Cleaning Roller",
        description: "Drum cleaning roller assembly",
        quantity: 1,
        compatibleModel: "Valezus",
        inStock: 3,
        inventoryStatus: status(3, 1),
      },
    ],
    Transport: [
      {
        calloutNumber: "50",
        partNumber: "RIS-VA-TR-5001",
        partName: "Belt Tensioner",
        description: "Main belt tensioner unit",
        quantity: 1,
        compatibleModel: "Valezus",
        inStock: 1,
        inventoryStatus: status(1, 1),
      },
    ],
    "Exit Area": [
      {
        calloutNumber: "60",
        partNumber: "RIS-VA-EX-6001",
        partName: "Finisher Exit Roller",
        description: "Finisher output roller set",
        quantity: 1,
        compatibleModel: "Valezus",
        inStock: 2,
        inventoryStatus: status(2, 1),
      },
    ],
    "Ink / Supply": [
      {
        calloutNumber: "70",
        partNumber: "RIS-VA-INK-7001",
        partName: "CMYK Ink Set",
        description: "Full color ink cartridge set",
        quantity: 1,
        compatibleModel: "Valezus",
        inStock: 4,
        inventoryStatus: status(4, 1),
      },
    ],
    "Duplex / Paper Path": [
      {
        calloutNumber: "80",
        partNumber: "RIS-VA-DP-8001",
        partName: "Paper Path Guide Plate",
        description: "Duplex paper path guide plate",
        quantity: 1,
        compatibleModel: "Valezus",
        inStock: 0,
        inventoryStatus: status(0, 1),
      },
    ],
  },
};

export function getCalloutsForAssembly(
  model: PrinterModel,
  assembly: AssemblySection,
): DiagramCalloutRow[] {
  return diagramCallouts[model][assembly];
}

export function createInitialCart(): CartLine[] {
  return [
    {
      id: "cart-1",
      calloutNumber: "13",
      partNumber: "RIS-GD-FU-1202",
      partName: "Separation Pad Assembly",
      quantityNeeded: 2,
      inStock: 1,
      orderQuantity: 1,
      reason: "Worn during Tray 2 service",
    },
  ];
}

export function getSuggestedOrderQuantity(needed: number, inStock: number): number {
  const shortfall = needed - inStock;
  return shortfall > 0 ? shortfall : 0;
}

export const inventoryStatusStyles: Record<InventoryStatus, string> = {
  "In Stock": "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  "Low Stock": "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  "Order Required": "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30",
};
