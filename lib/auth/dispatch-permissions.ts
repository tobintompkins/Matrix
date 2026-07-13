import { hasMatrixPermission } from "./permissions";
import type { MatrixPermission, MatrixRole } from "./types";

export function canViewDispatchBoard(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_DISPATCH_BOARD") ||
    hasMatrixPermission(role, "ASSIGN_SERVICE_CALL") ||
    hasMatrixPermission(role, "MANAGE_SERVICE_CALLS")
  );
}

export function canDispatchTickets(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "DISPATCH_TICKETS") ||
    hasMatrixPermission(role, "ASSIGN_SERVICE_CALL") ||
    hasMatrixPermission(role, "MANAGE_SERVICE_CALLS")
  );
}

export function canConfigureSla(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "CONFIGURE_SLA_RULES");
}

export function canConfigureEscalation(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "CONFIGURE_ESCALATION_RULES");
}

export function canConfigureTicketCategories(role: MatrixRole): boolean {
  return hasMatrixPermission(role, "CONFIGURE_TICKET_CATEGORIES");
}

export function canViewCustomerPortalTickets(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "VIEW_CUSTOMER_PORTAL_TICKETS") ||
    hasMatrixPermission(role, "VIEW_SERVICE_CALLS")
  );
}

export function canCreateCustomerPortalTicket(role: MatrixRole): boolean {
  return (
    hasMatrixPermission(role, "CREATE_CUSTOMER_PORTAL_TICKET") ||
    hasMatrixPermission(role, "CREATE_SERVICE_CALL")
  );
}

export const DISPATCH_PERMISSIONS: MatrixPermission[] = [
  "VIEW_DISPATCH_BOARD",
  "DISPATCH_TICKETS",
  "CONFIGURE_SLA_RULES",
  "CONFIGURE_ESCALATION_RULES",
  "CONFIGURE_TICKET_CATEGORIES",
  "VIEW_CUSTOMER_PORTAL_TICKETS",
  "CREATE_CUSTOMER_PORTAL_TICKET",
];
