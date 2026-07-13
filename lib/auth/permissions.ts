import {
  DEV_FALLBACK_ROLE,
  type MatrixPermission,
  type MatrixRole,
} from "./types";

const SERVICE_CALL_PERMISSIONS: MatrixPermission[] = [
  "VIEW_SERVICE_CALLS",
  "CREATE_SERVICE_CALL",
  "EDIT_SERVICE_CALL",
  "ASSIGN_SERVICE_CALL",
  "ACCEPT_SERVICE_CALL",
  "UPDATE_SERVICE_CALL_STATUS",
  "ADD_SERVICE_CALL_NOTE",
  "RESOLVE_SERVICE_CALL",
  "CLOSE_SERVICE_CALL",
  "CANCEL_SERVICE_CALL",
  "VIEW_INTERNAL_NOTES",
  "MANAGE_SERVICE_CALLS",
  "VIEW_DISPATCH_BOARD",
  "DISPATCH_TICKETS",
  "CONFIGURE_SLA_RULES",
  "CONFIGURE_ESCALATION_RULES",
  "CONFIGURE_TICKET_CATEGORIES",
  "VIEW_CUSTOMER_PORTAL_TICKETS",
  "CREATE_CUSTOMER_PORTAL_TICKET",
];

const PORTAL_STAFF_PERMISSIONS: MatrixPermission[] = [
  "VIEW_CUSTOMER_PORTAL",
  "MANAGE_PORTAL_USERS",
  "ADMINISTER_CUSTOMER_PORTAL",
  "APPROVE_PORTAL_SERVICE",
  "VIEW_PORTAL_METERS",
  "VIEW_PORTAL_PM",
  "DOWNLOAD_PORTAL_REPORTS",
];

const NOTIFICATION_PERMISSIONS: MatrixPermission[] = [
  "VIEW_NOTIFICATIONS",
  "MANAGE_NOTIFICATION_PREFERENCES",
  "EDIT_REMINDER_THRESHOLDS",
];

const MAINTENANCE_PERMISSIONS: MatrixPermission[] = [
  "MANAGE_PM",
  "ENTER_COPY_COUNT",
  "COMPLETE_MAINTENANCE",
  "VIEW_MAINTENANCE_HISTORY",
  "EDIT_MAINTENANCE_BASELINE",
  "EDIT_MAINTENANCE_INTERVALS",
  "CORRECT_MAINTENANCE_RECORDS",
  "VIEW_FLEET_MAINTENANCE",
  "SCHEDULE_MAINTENANCE",
  "ASSIGN_MAINTENANCE",
  "EXPORT_MAINTENANCE",
  "VIEW_PM_INTELLIGENCE",
  "MANAGE_PM_SETTINGS",
  "IMPORT_METER_COUNTS",
  "OVERRIDE_METER_VALIDATION",
  "VIEW_PM_FORECASTING",
  "VIEW_PM_EXECUTIVE",
  ...NOTIFICATION_PERMISSIONS,
];

const WORK_ORDER_PERMISSIONS: MatrixPermission[] = [
  "VIEW_WORK_ORDERS",
  "CREATE_WORK_ORDER",
  "EDIT_WORK_ORDER",
  "ASSIGN_WORK_ORDER",
  "UPDATE_WORK_ORDER",
  "COMPLETE_WORK_ORDER",
  "MANAGE_WORK_ORDERS",
  "VIEW_WORK_ORDER_INTERNAL_NOTES",
];

const FIELD_PERMISSIONS: MatrixPermission[] = [
  "VIEW_FIELD",
  "USE_OFFLINE_FIELD",
  "DOWNLOAD_OFFLINE_PACKAGES",
  "SYNC_FIELD_QUEUE",
  "RESOLVE_FIELD_CONFLICTS",
  "CONFIGURE_OFFLINE_POLICIES",
  "VIEW_FIELD_ALL_TECHNICIANS",
];

const CRM_PERMISSIONS: MatrixPermission[] = [
  "VIEW_CUSTOMERS",
  "MANAGE_CUSTOMERS",
  "VIEW_SITES",
  "MANAGE_SITES",
  "MANAGE_CONTACTS",
  "MANAGE_CONTRACTS",
  "MANAGE_WARRANTIES",
  "MANAGE_ASSETS",
  "UPDATE_ASSET_SERVICE_INFO",
];

const INVENTORY_PERMISSIONS: MatrixPermission[] = [
  "VIEW_INVENTORY",
  "EDIT_INVENTORY",
  "CONSUME_INVENTORY",
  "RECEIVE_INVENTORY",
  "TRANSFER_INVENTORY",
  "ADJUST_INVENTORY",
  "COUNT_INVENTORY",
  "RESERVE_INVENTORY",
  "CREATE_PARTS_ORDER",
  "APPROVE_PARTS_ORDER",
  "MANAGE_INVENTORY_SETTINGS",
  "VIEW_INVENTORY_REPORTS",
  "VIEW_SCANNER",
  "MANAGE_WAREHOUSES",
  "APPROVE_INVENTORY_TRANSFERS",
  "VIEW_INVENTORY_COSTS",
  "DELETE_INVENTORY",
  "EXPORT_INVENTORY",
  "PRINT_INVENTORY_REPORTS",
  "APPROVE_CYCLE_COUNTS",
];

const ALL_PERMISSIONS: MatrixPermission[] = [
  "VIEW_DASHBOARD",
  ...INVENTORY_PERMISSIONS,
  "VIEW_DIGITAL_TWIN",
  "EDIT_DIGITAL_TWIN",
  ...SERVICE_CALL_PERMISSIONS,
  ...PORTAL_STAFF_PERMISSIONS,
  ...MAINTENANCE_PERMISSIONS,
  ...WORK_ORDER_PERMISSIONS,
  ...FIELD_PERMISSIONS,
  ...CRM_PERMISSIONS,
  "VIEW_REPORTS",
  "MANAGE_USERS",
  "MANAGE_SETTINGS",
];

const ROLE_PERMISSIONS: Record<MatrixRole, MatrixPermission[]> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],
  ADMIN: [...ALL_PERMISSIONS],
  SERVICE_MANAGER: [
    "VIEW_DASHBOARD",
    "VIEW_INVENTORY",
    "CONSUME_INVENTORY",
    "RECEIVE_INVENTORY",
    "TRANSFER_INVENTORY",
    "ADJUST_INVENTORY",
    "COUNT_INVENTORY",
    "RESERVE_INVENTORY",
    "CREATE_PARTS_ORDER",
    "APPROVE_PARTS_ORDER",
    "MANAGE_INVENTORY_SETTINGS",
    "VIEW_INVENTORY_REPORTS",
    "VIEW_SCANNER",
    "MANAGE_WAREHOUSES",
    "APPROVE_INVENTORY_TRANSFERS",
    "VIEW_INVENTORY_COSTS",
    "EXPORT_INVENTORY",
    "PRINT_INVENTORY_REPORTS",
    "APPROVE_CYCLE_COUNTS",
    "VIEW_DIGITAL_TWIN",
    "EDIT_DIGITAL_TWIN",
    ...SERVICE_CALL_PERMISSIONS,
    ...MAINTENANCE_PERMISSIONS,
    ...WORK_ORDER_PERMISSIONS,
    "VIEW_FIELD",
    "USE_OFFLINE_FIELD",
    "DOWNLOAD_OFFLINE_PACKAGES",
    "SYNC_FIELD_QUEUE",
    "RESOLVE_FIELD_CONFLICTS",
    "CONFIGURE_OFFLINE_POLICIES",
    "VIEW_FIELD_ALL_TECHNICIANS",
    "VIEW_CUSTOMERS",
    "MANAGE_CUSTOMERS",
    "VIEW_SITES",
    "MANAGE_SITES",
    "MANAGE_CONTACTS",
    "MANAGE_CONTRACTS",
    "MANAGE_WARRANTIES",
    "MANAGE_ASSETS",
    "UPDATE_ASSET_SERVICE_INFO",
    "VIEW_REPORTS",
    "ADMINISTER_CUSTOMER_PORTAL",
    ...PORTAL_STAFF_PERMISSIONS,
  ],
  FIELD_TECHNICIAN: [
    "VIEW_DASHBOARD",
    "VIEW_INVENTORY",
    "CONSUME_INVENTORY",
    "COUNT_INVENTORY",
    "RESERVE_INVENTORY",
    "CREATE_PARTS_ORDER",
    "VIEW_SCANNER",
    "VIEW_DIGITAL_TWIN",
    "VIEW_SERVICE_CALLS",
    "CREATE_SERVICE_CALL",
    "EDIT_SERVICE_CALL",
    "ACCEPT_SERVICE_CALL",
    "UPDATE_SERVICE_CALL_STATUS",
    "ADD_SERVICE_CALL_NOTE",
    "RESOLVE_SERVICE_CALL",
    "VIEW_INTERNAL_NOTES",
    "MANAGE_SERVICE_CALLS",
    "MANAGE_PM",
    "ENTER_COPY_COUNT",
    "COMPLETE_MAINTENANCE",
    "VIEW_MAINTENANCE_HISTORY",
    "VIEW_FLEET_MAINTENANCE",
    "VIEW_NOTIFICATIONS",
    "MANAGE_NOTIFICATION_PREFERENCES",
    "VIEW_WORK_ORDERS",
    "CREATE_WORK_ORDER",
    "EDIT_WORK_ORDER",
    "UPDATE_WORK_ORDER",
    "COMPLETE_WORK_ORDER",
    "VIEW_WORK_ORDER_INTERNAL_NOTES",
    "VIEW_FIELD",
    "USE_OFFLINE_FIELD",
    "DOWNLOAD_OFFLINE_PACKAGES",
    "SYNC_FIELD_QUEUE",
    "VIEW_CUSTOMERS",
    "VIEW_SITES",
    "UPDATE_ASSET_SERVICE_INFO",
  ],
  WAREHOUSE_MANAGER: [
    "VIEW_DASHBOARD",
    "VIEW_INVENTORY",
    "EDIT_INVENTORY",
    "CONSUME_INVENTORY",
    "RECEIVE_INVENTORY",
    "TRANSFER_INVENTORY",
    "ADJUST_INVENTORY",
    "COUNT_INVENTORY",
    "RESERVE_INVENTORY",
    "CREATE_PARTS_ORDER",
    "APPROVE_PARTS_ORDER",
    "VIEW_INVENTORY_REPORTS",
    "VIEW_SCANNER",
    "MANAGE_WAREHOUSES",
    "APPROVE_INVENTORY_TRANSFERS",
    "VIEW_INVENTORY_COSTS",
    "EXPORT_INVENTORY",
    "PRINT_INVENTORY_REPORTS",
    "APPROVE_CYCLE_COUNTS",
    "VIEW_DIGITAL_TWIN",
    "VIEW_SERVICE_CALLS",
    "VIEW_MAINTENANCE_HISTORY",
    "VIEW_FLEET_MAINTENANCE",
    "VIEW_NOTIFICATIONS",
    "VIEW_WORK_ORDERS",
    "VIEW_REPORTS",
  ],
  TRAINER: [
    "VIEW_DASHBOARD",
    "VIEW_INVENTORY",
    "VIEW_SCANNER",
    "VIEW_DIGITAL_TWIN",
    "VIEW_SERVICE_CALLS",
    "ADD_SERVICE_CALL_NOTE",
    "VIEW_MAINTENANCE_HISTORY",
    "VIEW_FLEET_MAINTENANCE",
    "VIEW_NOTIFICATIONS",
    "VIEW_REPORTS",
  ],
  CUSTOMER_ADMIN: [
    "VIEW_DASHBOARD",
    "VIEW_CUSTOMER_PORTAL",
    "VIEW_CUSTOMER_PORTAL_TICKETS",
    "CREATE_CUSTOMER_PORTAL_TICKET",
    "MANAGE_PORTAL_USERS",
    "APPROVE_PORTAL_SERVICE",
    "VIEW_PORTAL_METERS",
    "VIEW_PORTAL_PM",
    "DOWNLOAD_PORTAL_REPORTS",
    "VIEW_NOTIFICATIONS",
    "MANAGE_NOTIFICATION_PREFERENCES",
    "VIEW_REPORTS",
  ],
  CUSTOMER_MANAGER: [
    "VIEW_DASHBOARD",
    "VIEW_CUSTOMER_PORTAL",
    "VIEW_CUSTOMER_PORTAL_TICKETS",
    "CREATE_CUSTOMER_PORTAL_TICKET",
    "APPROVE_PORTAL_SERVICE",
    "VIEW_PORTAL_METERS",
    "VIEW_PORTAL_PM",
    "DOWNLOAD_PORTAL_REPORTS",
    "VIEW_NOTIFICATIONS",
    "MANAGE_NOTIFICATION_PREFERENCES",
    "VIEW_REPORTS",
  ],
  CUSTOMER_USER: [
    "VIEW_DASHBOARD",
    "VIEW_CUSTOMER_PORTAL",
    "VIEW_CUSTOMER_PORTAL_TICKETS",
    "CREATE_CUSTOMER_PORTAL_TICKET",
    "VIEW_PORTAL_METERS",
    "VIEW_PORTAL_PM",
    "DOWNLOAD_PORTAL_REPORTS",
    "VIEW_NOTIFICATIONS",
    "MANAGE_NOTIFICATION_PREFERENCES",
  ],
  CUSTOMER_VIEWER: [
    "VIEW_DASHBOARD",
    "VIEW_CUSTOMER_PORTAL",
    "VIEW_CUSTOMER_PORTAL_TICKETS",
    "VIEW_PORTAL_PM",
    "DOWNLOAD_PORTAL_REPORTS",
    "VIEW_NOTIFICATIONS",
    "VIEW_REPORTS",
  ],
};

/** Route → required permission (foundation for future guards). */
const ROUTE_PERMISSIONS: Array<{ prefix: string; permission: MatrixPermission }> =
  [
    { prefix: "/dashboard", permission: "VIEW_DASHBOARD" },
    { prefix: "/inventory", permission: "VIEW_INVENTORY" },
    { prefix: "/scanner", permission: "VIEW_SCANNER" },
    { prefix: "/parts-order", permission: "CREATE_PARTS_ORDER" },
    { prefix: "/parts-order-builder", permission: "CREATE_PARTS_ORDER" },
    { prefix: "/order-parts", permission: "CREATE_PARTS_ORDER" },
    { prefix: "/parts", permission: "CREATE_PARTS_ORDER" },
    { prefix: "/diagrams", permission: "VIEW_DIGITAL_TWIN" },
    { prefix: "/diagram-library", permission: "VIEW_DIGITAL_TWIN" },
    { prefix: "/guided-diagram-ordering", permission: "CREATE_PARTS_ORDER" },
    { prefix: "/digital-twin", permission: "VIEW_DIGITAL_TWIN" },
    { prefix: "/printers", permission: "VIEW_DIGITAL_TWIN" },
    { prefix: "/fleet", permission: "VIEW_DIGITAL_TWIN" },
    { prefix: "/service-calls", permission: "VIEW_SERVICE_CALLS" },
    { prefix: "/dispatch", permission: "VIEW_DISPATCH_BOARD" },
    { prefix: "/portal", permission: "VIEW_CUSTOMER_PORTAL" },
    { prefix: "/admin/portal", permission: "ADMINISTER_CUSTOMER_PORTAL" },
    { prefix: "/tickets", permission: "VIEW_SERVICE_CALLS" },
    { prefix: "/new-ticket", permission: "CREATE_SERVICE_CALL" },
    { prefix: "/pm", permission: "MANAGE_PM" },
    { prefix: "/start-pm", permission: "MANAGE_PM" },
    { prefix: "/request-pm-kit", permission: "MANAGE_PM" },
    { prefix: "/maintenance", permission: "VIEW_FLEET_MAINTENANCE" },
    { prefix: "/notifications", permission: "VIEW_NOTIFICATIONS" },
    { prefix: "/work-orders", permission: "VIEW_WORK_ORDERS" },
    { prefix: "/field", permission: "VIEW_FIELD" },
    { prefix: "/customers", permission: "VIEW_CUSTOMERS" },
    { prefix: "/add-customer", permission: "MANAGE_CUSTOMERS" },
    { prefix: "/reports", permission: "VIEW_REPORTS" },
    { prefix: "/admin", permission: "MANAGE_USERS" },
    { prefix: "/settings", permission: "MANAGE_SETTINGS" },
  ];

export function getDefaultPermissionsForRole(
  role: MatrixRole,
): MatrixPermission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function hasMatrixPermission(
  role: MatrixRole,
  permission: MatrixPermission,
): boolean {
  return getDefaultPermissionsForRole(role).includes(permission);
}

export function canAccessRoute(role: MatrixRole, pathname: string): boolean {
  const match = ROUTE_PERMISSIONS.find(
    (entry) =>
      pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  if (!match) return true;
  return hasMatrixPermission(role, match.permission);
}

/**
 * Resolve role from Clerk publicMetadata when available.
 * Falls back to SUPER_ADMIN in development so work is not blocked.
 */
export function resolveMatrixRole(
  publicMetadata?: Record<string, unknown> | null,
): { role: MatrixRole; usingDevFallbackRole: boolean } {
  const metaRole = publicMetadata?.matrixRole;
  if (typeof metaRole === "string" && metaRole in ROLE_PERMISSIONS) {
    return {
      role: metaRole as MatrixRole,
      usingDevFallbackRole: false,
    };
  }
  return { role: DEV_FALLBACK_ROLE, usingDevFallbackRole: true };
}
