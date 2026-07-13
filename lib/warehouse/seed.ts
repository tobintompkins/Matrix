import type {
  BinLocation,
  CycleCountSession,
  InventoryAlert,
  InventoryTransferOrder,
  ReceivingSession,
  TruckRestockRequest,
  WarehouseAuditEntry,
  WarehouseEmployee,
  WarehouseProfile,
} from "./types";
import { formatBinCode } from "./location";

const now = "2026-07-12T14:00:00.000Z";

export const WAREHOUSE_PROFILES: WarehouseProfile[] = [
  {
    id: "wh-main",
    name: "Main Warehouse — HQ",
    code: "WH1",
    address: "100 Matrix Drive, Boston, MA 02101",
    manager: "Casey Nguyen",
    phone: "617-555-0100",
    email: "warehouse@matrix.example",
    receivingDock: "Dock A–C",
    shippingArea: "Bay 1–4",
    hours: "Mon–Fri 06:00–18:00",
    status: "ACTIVE",
    region: "Northeast",
    enterpriseLocationId: "loc-main",
    activeTechnicianIds: ["tech-alex", "tech-sam"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: now,
  },
  {
    id: "wh-regional",
    name: "Regional Warehouse — Mid-Atlantic",
    code: "WH2",
    address: "440 Depot Rd, Baltimore, MD 21201",
    manager: "Morgan Blake",
    phone: "410-555-0140",
    email: "regional@matrix.example",
    receivingDock: "Dock 1",
    shippingArea: "Staging West",
    hours: "Mon–Fri 07:00–17:00",
    status: "ACTIVE",
    region: "Mid-Atlantic",
    enterpriseLocationId: "loc-regional",
    activeTechnicianIds: ["tech-sam"],
    createdAt: "2025-03-15T00:00:00.000Z",
    updatedAt: now,
  },
  {
    id: "wh-emergency",
    name: "Emergency Depot — Northeast",
    code: "WH-EMG",
    address: "12 Rapid Response Ln, Worcester, MA 01602",
    manager: "Riley Chen",
    phone: "508-555-0199",
    email: "emergency-parts@matrix.example",
    receivingDock: "Express Door",
    shippingArea: "Hot Shelf",
    hours: "24/7 on-call",
    status: "ACTIVE",
    region: "Northeast",
    enterpriseLocationId: "loc-consign",
    activeTechnicianIds: [],
    createdAt: "2025-06-01T00:00:00.000Z",
    updatedAt: now,
  },
];

function bin(
  id: string,
  warehouseId: string,
  codePrefix: string,
  zone: string,
  aisle: string,
  rack: string,
  shelf: string,
  binNum: string,
  drawer = "",
): BinLocation {
  return {
    id,
    warehouseId,
    zone,
    aisle,
    rack,
    shelf,
    bin: binNum,
    drawer,
    code: formatBinCode(codePrefix, zone, aisle, rack, shelf, binNum, drawer),
    active: true,
  };
}

export const BIN_LOCATIONS: BinLocation[] = [
  bin("bin-wh1-a03-r2-s4-b17", "wh-main", "WH1", "A", "03", "R2", "S4", "B17"),
  bin("bin-wh1-a03-r2-s4-b18", "wh-main", "WH1", "A", "03", "R2", "S4", "B18"),
  bin("bin-wh1-b01-r1-s2-b05", "wh-main", "WH1", "B", "01", "R1", "S2", "B05"),
  bin("bin-wh1-c02-r3-s1-b01", "wh-main", "WH1", "C", "02", "R3", "S1", "B01", "D1"),
  bin("bin-wh1-recv-01", "wh-main", "WH1", "RECV", "01", "R1", "S1", "STAGE"),
  bin("bin-wh2-a01-r1-s1-b01", "wh-regional", "WH2", "A", "01", "R1", "S1", "B01"),
  bin("bin-wh2-a01-r1-s1-b02", "wh-regional", "WH2", "A", "01", "R1", "S1", "B02"),
  bin("bin-wh2-recv-01", "wh-regional", "WH2", "RECV", "01", "R1", "S1", "STAGE"),
  bin("bin-emg-hot-01", "wh-emergency", "WH-EMG", "HOT", "01", "R1", "S1", "B01"),
];

/** Maps enterprise stock balance id → preferred bin location. */
export const STOCK_BIN_ASSIGNMENTS: Record<string, string> = {
  "stk-1": "bin-wh1-a03-r2-s4-b17",
  "stk-3": "bin-wh1-a03-r2-s4-b18",
  "stk-5": "bin-wh1-c02-r3-s1-b01",
  "stk-7": "bin-wh2-a01-r1-s1-b01",
  "stk-8": "bin-wh1-b01-r1-s2-b05",
  "stk-10": "bin-wh1-b01-r1-s2-b05",
  "stk-11": "bin-wh2-a01-r1-s1-b02",
};

export const WAREHOUSE_EMPLOYEES: WarehouseEmployee[] = [
  {
    id: "emp-1",
    warehouseId: "wh-main",
    name: "Casey Nguyen",
    role: "Warehouse Manager",
    phone: "617-555-0100",
    email: "casey@matrix.example",
    active: true,
  },
  {
    id: "emp-2",
    warehouseId: "wh-main",
    name: "Pat Okonkwo",
    role: "Receiver",
    phone: "617-555-0101",
    email: "pat@matrix.example",
    active: true,
  },
  {
    id: "emp-3",
    warehouseId: "wh-regional",
    name: "Morgan Blake",
    role: "Warehouse Manager",
    phone: "410-555-0140",
    email: "morgan@matrix.example",
    active: true,
  },
];

export const SEED_TRANSFERS: InventoryTransferOrder[] = [
  {
    id: "xfr-1",
    transferNumber: "XFR-2026-0001",
    kind: "WAREHOUSE_TO_TRUCK",
    status: "In Transit",
    fromWarehouseId: "wh-main",
    toWarehouseId: "wh-main",
    fromLocationId: "loc-main",
    toLocationId: "loc-truck-alex",
    requestedBy: "Casey Nguyen",
    approvedBy: "Casey Nguyen",
    notes: "Weekly truck restock — Alex",
    lines: [
      {
        id: "xfrl-1",
        partId: "part-014-12345",
        partNumber: "014-12345",
        description: "Master Roll Assembly",
        quantityRequested: 2,
        quantityShipped: 2,
        quantityReceived: 0,
        binFromId: "bin-wh1-a03-r2-s4-b17",
        binToId: null,
      },
    ],
    requestedAt: "2026-07-11T09:00:00.000Z",
    approvedAt: "2026-07-11T09:15:00.000Z",
    shippedAt: "2026-07-11T14:00:00.000Z",
    deliveredAt: null,
    receivedAt: null,
    cancelledAt: null,
    emergency: false,
  },
  {
    id: "xfr-2",
    transferNumber: "XFR-2026-0002",
    kind: "WAREHOUSE_TO_WAREHOUSE",
    status: "Requested",
    fromWarehouseId: "wh-main",
    toWarehouseId: "wh-regional",
    fromLocationId: "loc-main",
    toLocationId: "loc-regional",
    requestedBy: "Morgan Blake",
    approvedBy: null,
    notes: "Regional replenishment — ink drums",
    lines: [
      {
        id: "xfrl-2",
        partId: "part-014-67890",
        partNumber: "014-67890",
        description: "Ink Drum Unit",
        quantityRequested: 5,
        quantityShipped: 0,
        quantityReceived: 0,
        binFromId: "bin-wh1-a03-r2-s4-b18",
        binToId: "bin-wh2-a01-r1-s1-b02",
      },
    ],
    requestedAt: "2026-07-12T10:00:00.000Z",
    approvedAt: null,
    shippedAt: null,
    deliveredAt: null,
    receivedAt: null,
    cancelledAt: null,
    emergency: false,
  },
];

export const SEED_RECEIVING: ReceivingSession[] = [
  {
    id: "rcv-1",
    sessionNumber: "RCV-2026-0001",
    purchaseRequestId: null,
    purchaseRequestNumber: "PR-SEED-OPEN",
    warehouseId: "wh-main",
    step: "VERIFY_QUANTITIES",
    status: "IN_PROGRESS",
    lines: [
      {
        id: "rcvl-1",
        partId: "part-s-8224",
        partNumber: "S-8224",
        description: "Thermal Print Head",
        expectedQty: 4,
        receivedQty: 4,
        inspectedOk: true,
        inspectNotes: "",
        binLocationId: null,
        locationCode: "",
      },
    ],
    receiver: "Pat Okonkwo",
    labelsPrinted: false,
    startedAt: "2026-07-12T08:30:00.000Z",
    completedAt: null,
    notes: "Partial receive in progress",
  },
];

export const SEED_CYCLE_COUNTS: CycleCountSession[] = [
  {
    id: "cc-1",
    countNumber: "CC-2026-0001",
    warehouseId: "wh-main",
    type: "BIN",
    status: "IN_PROGRESS",
    categoryFilter: null,
    binFilter: "bin-wh1-a03-r2-s4-b17",
    lines: [
      {
        id: "ccl-1",
        partId: "part-014-12345",
        partNumber: "014-12345",
        description: "Master Roll Assembly",
        binLocationId: "bin-wh1-a03-r2-s4-b17",
        locationCode: "WH1-A-03-R2-S4-B17",
        expectedQty: 48,
        actualQty: null,
        variance: null,
        reason: "",
      },
    ],
    createdBy: "Casey Nguyen",
    approvedBy: null,
    scheduledAt: "2026-07-12T07:00:00.000Z",
    completedAt: null,
    notes: "ABC class-A bin count",
  },
];

export const SEED_TRUCK_RESTOCK: TruckRestockRequest[] = [];

export const SEED_ALERTS: InventoryAlert[] = [
  {
    id: "alert-1",
    type: "CRITICAL_STOCK",
    title: "Critical low stock",
    message: "014-55110 is below critical threshold at Main Warehouse.",
    warehouseId: "wh-main",
    partNumber: "014-55110",
    referenceId: null,
    createdAt: "2026-07-11T16:00:00.000Z",
    acknowledgedAt: null,
    priority: "URGENT",
  },
  {
    id: "alert-2",
    type: "CYCLE_COUNT_DUE",
    title: "Cycle count due",
    message: "Bin WH1-A-03-R2-S4-B17 cycle count is due today.",
    warehouseId: "wh-main",
    partNumber: null,
    referenceId: "cc-1",
    createdAt: "2026-07-12T06:00:00.000Z",
    acknowledgedAt: null,
    priority: "HIGH",
  },
];

export const SEED_AUDIT: WarehouseAuditEntry[] = [
  {
    id: "waudit-1",
    timestamp: "2026-07-11T14:00:00.000Z",
    technician: "Warehouse",
    warehouseId: "wh-main",
    inventoryItemId: "bal-014-55110-main",
    partNumber: "014-55110",
    quantityBefore: 16,
    quantityAfter: 15,
    adjustment: -1,
    reason: "Restock truck",
    referenceNumber: "txn-seed-3",
    sourceModule: "enterprise-inventory",
    ipAddress: "127.0.0.1",
    device: "seed",
  },
];

/** Recommended truck stock targets (partNumber → qty). */
export const TRUCK_RECOMMENDED_STOCK: Record<string, number> = {
  "014-12345": 4,
  "014-67890": 2,
  "014-55110": 2,
  "S-8224": 1,
  "FILTER-KIT-01": 3,
};

export const TRUCK_CRITICAL_PARTS = ["014-12345", "S-8224", "014-55110"];
export const TRUCK_EMERGENCY_KIT = ["014-12345", "FILTER-KIT-01"];
export const TRUCK_CONSUMABLES = ["014-12345", "FILTER-KIT-01"];
export const TRUCK_FAST_MOVING = ["014-12345", "014-67890"];
