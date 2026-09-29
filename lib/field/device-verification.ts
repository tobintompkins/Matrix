/** Patch 51B.2.12/51B.2.13 — manager Field device verification local draft. */
export type DeviceVerificationStatus = "not-tested" | "pass" | "fail";

export const FIELD_DEVICE_VERIFICATION_STORAGE_KEY =
  "matrix-field-device-verification-v1";

export const DEVICE_VERIFICATION_CHECKS = [
  {
    id: "assigned_work_order_download",
    label: "Assigned work order download",
    hint: "Download an assigned job and reopen it from offline storage.",
  },
  {
    id: "offline_note",
    label: "Offline note",
    hint: "Add a note while offline, then sync when back online.",
  },
  {
    id: "offline_part",
    label: "Offline part usage",
    hint: "Record a part line offline and confirm it queues for sync.",
  },
  {
    id: "offline_photo",
    label: "Offline photo",
    hint: "Capture or attach a photo offline; confirm the queue item stays visible until sync.",
  },
  {
    id: "offline_signature",
    label: "Offline signature",
    hint: "Capture a signature or record a declined-signature reason offline.",
  },
  {
    id: "interrupted_sync_retry",
    label: "Interrupted sync / retry",
    hint: "Interrupt sync (go offline mid-sync), reconnect, and retry without duplicates.",
  },
  {
    id: "conflict_handling",
    label: "Conflict handling",
    hint: "Confirm conflicting changes are surfaced for review, not silently overwritten.",
  },
  {
    id: "work_order_completion",
    label: "Work order completion",
    hint: "Complete a job only after required checklist items are satisfied.",
  },
] as const;

export type DeviceVerificationCheckId = (typeof DEVICE_VERIFICATION_CHECKS)[number]["id"];

export type FieldDeviceVerificationRecord = {
  version: 1;
  updatedAt: string;
  testerName: string;
  deviceLabel: string;
  browserLabel: string;
  /** ISO date (YYYY-MM-DD) for the field test session */
  testDate: string;
  notes: string;
  checks: Record<DeviceVerificationCheckId, DeviceVerificationStatus>;
};

export type FieldDeviceVerificationReadiness = {
  state: "ready" | "blocked" | "incomplete";
  headline: string;
  detail: string;
  passed: number;
  failed: number;
  notTested: number;
  total: number;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function emptyChecks(): Record<DeviceVerificationCheckId, DeviceVerificationStatus> {
  return DEVICE_VERIFICATION_CHECKS.reduce(
    (acc, item) => {
      acc[item.id] = "not-tested";
      return acc;
    },
    {} as Record<DeviceVerificationCheckId, DeviceVerificationStatus>,
  );
}

export function createDefaultFieldDeviceVerificationRecord(
  now = new Date(),
): FieldDeviceVerificationRecord {
  const testDate = now.toISOString().slice(0, 10);
  return {
    version: 1,
    updatedAt: now.toISOString(),
    testerName: "",
    deviceLabel: "",
    browserLabel: "",
    testDate,
    notes: "",
    checks: emptyChecks(),
  };
}

function isCheckId(value: string): value is DeviceVerificationCheckId {
  return DEVICE_VERIFICATION_CHECKS.some((item) => item.id === value);
}

function isStatus(value: unknown): value is DeviceVerificationStatus {
  return value === "not-tested" || value === "pass" || value === "fail";
}

export function parseFieldDeviceVerificationRecord(
  raw: unknown,
): FieldDeviceVerificationRecord {
  const defaults = createDefaultFieldDeviceVerificationRecord();
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Partial<FieldDeviceVerificationRecord>;
  const checks = { ...defaults.checks };
  if (record.checks && typeof record.checks === "object") {
    for (const [key, status] of Object.entries(record.checks)) {
      if (isCheckId(key) && isStatus(status)) checks[key] = status;
    }
  }
  return {
    version: 1,
    updatedAt:
      typeof record.updatedAt === "string" && record.updatedAt
        ? record.updatedAt
        : defaults.updatedAt,
    testerName: typeof record.testerName === "string" ? record.testerName : "",
    deviceLabel: typeof record.deviceLabel === "string" ? record.deviceLabel : "",
    browserLabel: typeof record.browserLabel === "string" ? record.browserLabel : "",
    testDate: typeof record.testDate === "string" && record.testDate ? record.testDate : defaults.testDate,
    notes: typeof record.notes === "string" ? record.notes : "",
    checks,
  };
}

export function loadFieldDeviceVerificationFromStorage(
  storage: StorageLike,
): FieldDeviceVerificationRecord {
  try {
    const raw = storage.getItem(FIELD_DEVICE_VERIFICATION_STORAGE_KEY);
    if (!raw) return createDefaultFieldDeviceVerificationRecord();
    return parseFieldDeviceVerificationRecord(JSON.parse(raw));
  } catch {
    return createDefaultFieldDeviceVerificationRecord();
  }
}

export function saveFieldDeviceVerificationToStorage(
  storage: StorageLike,
  record: FieldDeviceVerificationRecord,
): FieldDeviceVerificationRecord {
  const next: FieldDeviceVerificationRecord = {
    ...record,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  storage.setItem(FIELD_DEVICE_VERIFICATION_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function summarizeFieldDeviceVerificationReadiness(
  record: FieldDeviceVerificationRecord,
): FieldDeviceVerificationReadiness {
  const statuses = DEVICE_VERIFICATION_CHECKS.map((item) => record.checks[item.id]);
  const total = statuses.length;
  const passed = statuses.filter((status) => status === "pass").length;
  const failed = statuses.filter((status) => status === "fail").length;
  const notTested = statuses.filter((status) => status === "not-tested").length;

  if (failed > 0) {
    return {
      state: "blocked",
      headline: "Not release-ready — failed checks must be resolved",
      detail: `${failed} failed · ${notTested} not tested · ${passed} passed`,
      passed,
      failed,
      notTested,
      total,
    };
  }
  if (notTested > 0) {
    return {
      state: "incomplete",
      headline: "Testing incomplete — finish all checklist items",
      detail: `${notTested} not tested · ${passed} passed`,
      passed,
      failed,
      notTested,
      total,
    };
  }
  return {
    state: "ready",
    headline: "Release-ready for Field real-device sign-off",
    detail: `All ${total} checks passed on ${record.testDate || "recorded date"}.`,
    passed,
    failed,
    notTested,
    total,
  };
}

export function formatFieldDeviceVerificationExport(
  record: FieldDeviceVerificationRecord,
): string {
  const readiness = summarizeFieldDeviceVerificationReadiness(record);
  const lines = [
    "Matrix Field Device Verification (51B.2.12)",
    `Updated: ${record.updatedAt}`,
    `Tester: ${record.testerName || "—"}`,
    `Device: ${record.deviceLabel || "—"}`,
    `Browser: ${record.browserLabel || "—"}`,
    `Test date: ${record.testDate || "—"}`,
    `Release readiness: ${readiness.headline}`,
    `Summary: ${readiness.detail}`,
    "",
    "Checks:",
    ...DEVICE_VERIFICATION_CHECKS.map((item) => {
      const status = record.checks[item.id];
      return `- [${status}] ${item.label}`;
    }),
  ];
  if (record.notes.trim()) {
    lines.push("", "Notes:", record.notes.trim());
  }
  return lines.join("\n");
}
