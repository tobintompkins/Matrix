/**
 * Matrix role & permission foundation for Clerk-backed auth.
 *
 * Future Clerk publicMetadata fields (placeholder — not required yet):
 * - matrixRole
 * - assignedRegion
 * - assignedTruckId
 * - assignedWarehouseId
 * - organizationId
 * - technicianId
 */

export type MatrixRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SERVICE_MANAGER"
  | "FIELD_TECHNICIAN"
  | "WAREHOUSE_MANAGER"
  | "TRAINER"
  | "CUSTOMER_ADMIN"
  | "CUSTOMER_MANAGER"
  | "CUSTOMER_USER"
  | "CUSTOMER_VIEWER";

export type MatrixPermission =
  | "VIEW_DASHBOARD"
  | "VIEW_INVENTORY"
  | "EDIT_INVENTORY"
  | "CONSUME_INVENTORY"
  | "RECEIVE_INVENTORY"
  | "TRANSFER_INVENTORY"
  | "ADJUST_INVENTORY"
  | "COUNT_INVENTORY"
  | "RESERVE_INVENTORY"
  | "CREATE_PARTS_ORDER"
  | "APPROVE_PARTS_ORDER"
  | "MANAGE_INVENTORY_SETTINGS"
  | "VIEW_INVENTORY_REPORTS"
  | "VIEW_SCANNER"
  | "MANAGE_WAREHOUSES"
  | "APPROVE_INVENTORY_TRANSFERS"
  | "VIEW_INVENTORY_COSTS"
  | "DELETE_INVENTORY"
  | "EXPORT_INVENTORY"
  | "PRINT_INVENTORY_REPORTS"
  | "APPROVE_CYCLE_COUNTS"
  | "VIEW_DIGITAL_TWIN"
  | "EDIT_DIGITAL_TWIN"
  | "VIEW_SERVICE_CALLS"
  | "CREATE_SERVICE_CALL"
  | "EDIT_SERVICE_CALL"
  | "ASSIGN_SERVICE_CALL"
  | "ACCEPT_SERVICE_CALL"
  | "UPDATE_SERVICE_CALL_STATUS"
  | "ADD_SERVICE_CALL_NOTE"
  | "RESOLVE_SERVICE_CALL"
  | "CLOSE_SERVICE_CALL"
  | "CANCEL_SERVICE_CALL"
  | "VIEW_INTERNAL_NOTES"
  | "MANAGE_SERVICE_CALLS"
  | "VIEW_DISPATCH_BOARD"
  | "DISPATCH_TICKETS"
  | "CONFIGURE_SLA_RULES"
  | "CONFIGURE_ESCALATION_RULES"
  | "CONFIGURE_TICKET_CATEGORIES"
  | "VIEW_CUSTOMER_PORTAL_TICKETS"
  | "CREATE_CUSTOMER_PORTAL_TICKET"
  | "VIEW_CUSTOMER_PORTAL"
  | "MANAGE_PORTAL_USERS"
  | "ADMINISTER_CUSTOMER_PORTAL"
  | "APPROVE_PORTAL_SERVICE"
  | "VIEW_PORTAL_METERS"
  | "VIEW_PORTAL_PM"
  | "DOWNLOAD_PORTAL_REPORTS"
  | "MANAGE_PM"
  | "ENTER_COPY_COUNT"
  | "COMPLETE_MAINTENANCE"
  | "VIEW_MAINTENANCE_HISTORY"
  | "EDIT_MAINTENANCE_BASELINE"
  | "EDIT_MAINTENANCE_INTERVALS"
  | "CORRECT_MAINTENANCE_RECORDS"
  | "VIEW_FLEET_MAINTENANCE"
  | "SCHEDULE_MAINTENANCE"
  | "ASSIGN_MAINTENANCE"
  | "EXPORT_MAINTENANCE"
  | "VIEW_PM_INTELLIGENCE"
  | "MANAGE_PM_SETTINGS"
  | "IMPORT_METER_COUNTS"
  | "OVERRIDE_METER_VALIDATION"
  | "VIEW_PM_FORECASTING"
  | "VIEW_PM_EXECUTIVE"
  | "VIEW_NOTIFICATIONS"
  | "MANAGE_NOTIFICATION_PREFERENCES"
  | "EDIT_REMINDER_THRESHOLDS"
  | "VIEW_WORK_ORDERS"
  | "CREATE_WORK_ORDER"
  | "EDIT_WORK_ORDER"
  | "ASSIGN_WORK_ORDER"
  | "UPDATE_WORK_ORDER"
  | "COMPLETE_WORK_ORDER"
  | "MANAGE_WORK_ORDERS"
  | "VIEW_WORK_ORDER_INTERNAL_NOTES"
  | "VIEW_FIELD"
  | "USE_OFFLINE_FIELD"
  | "DOWNLOAD_OFFLINE_PACKAGES"
  | "SYNC_FIELD_QUEUE"
  | "RESOLVE_FIELD_CONFLICTS"
  | "CONFIGURE_OFFLINE_POLICIES"
  | "VIEW_FIELD_ALL_TECHNICIANS"
  | "VIEW_CUSTOMERS"
  | "MANAGE_CUSTOMERS"
  | "VIEW_SITES"
  | "MANAGE_SITES"
  | "MANAGE_CONTACTS"
  | "MANAGE_CONTRACTS"
  | "MANAGE_WARRANTIES"
  | "MANAGE_ASSETS"
  | "UPDATE_ASSET_SERVICE_INFO"
  | "VIEW_REPORTS"
  | "MANAGE_USERS"
  | "MANAGE_SETTINGS";

export type MatrixOrganizationSlug = "sfx" | "mpx" | string;

export type MatrixOrganization = {
  id: string;
  slug: MatrixOrganizationSlug;
  name: string;
  /** Placeholder for future Clerk Organization id */
  clerkOrganizationId?: string;
};

export type MatrixUserProfile = {
  userId: string;
  email?: string;
  displayName?: string;
  role: MatrixRole;
  organizationId?: string;
  organizationSlug?: MatrixOrganizationSlug;
  /**
   * Future Clerk publicMetadata mapping (placeholders):
   * matrixRole, assignedRegion, assignedTruckId,
   * assignedWarehouseId, organizationId, technicianId
   */
  assignedRegion?: string;
  assignedTruckId?: string;
  assignedWarehouseId?: string;
  technicianId?: string;
};

export type MatrixAuthContext = {
  isSignedIn: boolean;
  user: MatrixUserProfile | null;
  organization: MatrixOrganization | null;
  permissions: MatrixPermission[];
  /** Development fallback until Clerk metadata is connected */
  usingDevFallbackRole: boolean;
};

/** Placeholder org catalog — SFX / MPX / future customers */
export const MATRIX_ORGANIZATION_PLACEHOLDERS: MatrixOrganization[] = [
  { id: "org-sfx", slug: "sfx", name: "SFX" },
  { id: "org-mpx", slug: "mpx", name: "MPX" },
];

/** Default development fallback so local work is not blocked. */
export const DEV_FALLBACK_ROLE: MatrixRole = "SUPER_ADMIN";
