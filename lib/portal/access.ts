import type {
  AccessLevel,
  CustomerLocationAccess,
  CustomerMembership,
  CustomerPrinterAccess,
  PortalCustomerRole,
} from "./types";

export function isMembershipActive(m: CustomerMembership): boolean {
  return m.status === "ACTIVE";
}

export function roleCanCreateTickets(role: PortalCustomerRole): boolean {
  return role !== "CUSTOMER_VIEWER";
}

export function roleCanApprove(
  membership: CustomerMembership,
): boolean {
  if (!isMembershipActive(membership)) return false;
  if (!membership.canApproveService) return false;
  return (
    membership.role === "CUSTOMER_ADMIN" ||
    membership.role === "CUSTOMER_MANAGER"
  );
}

export function roleCanManageUsers(membership: CustomerMembership): boolean {
  return (
    isMembershipActive(membership) &&
    membership.canManageUsers &&
    membership.role === "CUSTOMER_ADMIN"
  );
}

export function assertSameCustomer(
  membership: CustomerMembership,
  customerId: string,
): { ok: true } | { ok: false; error: string } {
  if (!isMembershipActive(membership)) {
    return { ok: false, error: "Membership is not active." };
  }
  if (membership.customerId !== customerId) {
    return { ok: false, error: "Unauthorized customer organization." };
  }
  return { ok: true };
}

export function hasLocationAccess(
  membership: CustomerMembership,
  locationAccess: CustomerLocationAccess[],
  locationId: string,
  minLevel: AccessLevel = "READ",
): boolean {
  if (!isMembershipActive(membership)) return false;
  if (membership.role === "CUSTOMER_ADMIN") return true;
  const row = locationAccess.find(
    (a) => a.membershipId === membership.id && a.locationId === locationId,
  );
  if (!row) return false;
  return accessLevelMeets(row.accessLevel, minLevel);
}

export function hasPrinterAccess(
  membership: CustomerMembership,
  printerAccess: CustomerPrinterAccess[],
  printerId: string,
  minLevel: AccessLevel = "READ",
): boolean {
  if (!isMembershipActive(membership)) return false;
  if (membership.role === "CUSTOMER_ADMIN") return true;
  const row = printerAccess.find(
    (a) => a.membershipId === membership.id && a.printerId === printerId,
  );
  if (!row) return false;
  return accessLevelMeets(row.accessLevel, minLevel);
}

function accessLevelMeets(have: AccessLevel, need: AccessLevel): boolean {
  const rank = { READ: 1, WRITE: 2, APPROVE: 3 };
  return rank[have] >= rank[need];
}

export function authorizedLocationIds(
  membership: CustomerMembership,
  locationAccess: CustomerLocationAccess[],
  allLocationIdsForCustomer: string[],
): string[] {
  if (!isMembershipActive(membership)) return [];
  if (membership.role === "CUSTOMER_ADMIN") return allLocationIdsForCustomer;
  return locationAccess
    .filter((a) => a.membershipId === membership.id)
    .map((a) => a.locationId);
}

export function authorizedPrinterIds(
  membership: CustomerMembership,
  printerAccess: CustomerPrinterAccess[],
  allPrinterIdsForCustomer: string[],
): string[] {
  if (!isMembershipActive(membership)) return [];
  if (membership.role === "CUSTOMER_ADMIN") return allPrinterIdsForCustomer;
  return printerAccess
    .filter((a) => a.membershipId === membership.id)
    .map((a) => a.printerId);
}
