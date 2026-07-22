/**
 * Client-safe Customer Portal exports.
 * Server-only modules (Prisma, meters, parts, contacts, enterprise, config)
 * must be imported from their dedicated paths — never re-exported here.
 */

export type * from "./types";

export {
  assertSameCustomer,
  authorizedLocationIds,
  authorizedPrinterIds,
  hasLocationAccess,
  hasPrinterAccess,
  isMembershipActive,
  roleCanApprove,
  roleCanCreateTickets,
  roleCanManageUsers,
} from "./access";

export {
  getCustomerActivityLabel,
  getCustomerStatusLabel,
  getCustomerStatusCodeLabel,
  mapInternalStatusToCustomer,
  buildCustomerVisibleTimeline,
  listCustomerStatusMappings,
  resetCustomerStatusLabelOverrides,
  setCustomerStatusLabelOverrides,
} from "./status-map";
export type { CustomerServiceStatus } from "./status-map";

export {
  checkRateLimit,
  resetRateLimitsForTests,
  safeFileName,
  validatePortalUpload,
} from "./security";

export {
  acceptInvitation,
  addPortalMessage,
  approvePortalWork,
  assertCustomerRecord,
  assertLocationAccess,
  assertPrinterAccess,
  attemptCrossCustomerTicketAccess,
  createInvitation,
  createPortalTicket,
  disableMembership,
  downloadPortalDocument,
  getActiveMembership,
  getNotificationPrefs,
  getPortalDashboard,
  getPortalLocation,
  getPortalPrinter,
  getPortalProfile,
  getPortalTicket,
  getSupportContact,
  getAuthorizedLocationIds,
  getAuthorizedPrinterIds,
  listAllMembershipsAdmin,
  listMembershipsForCustomer,
  listPendingInvitations,
  listPortalAnnouncements,
  listPortalAudit,
  listPortalDocuments,
  listPortalLocations,
  listPortalPrinters,
  listPortalReports,
  listPortalTickets,
  requireActiveMembership,
  requestPmScheduling,
  resetPortalForTests,
  saveNotificationPrefs,
  setActivePortalMembership,
  submitPortalFeedback,
  updatePortalProfile,
} from "./repository";

export {
  serializePortalDocument,
  serializePortalEquipment,
  serializePortalTicket,
  assertNoInternalLeak,
  mapPartsStatusForPortal,
  mapPmStatusForPortal,
} from "./serializers";
