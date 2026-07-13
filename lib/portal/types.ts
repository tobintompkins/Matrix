/**
 * Patch 42 — Secure Customer Portal types.
 */

export type PortalCustomerRole =
  | "CUSTOMER_ADMIN"
  | "CUSTOMER_MANAGER"
  | "CUSTOMER_USER"
  | "CUSTOMER_VIEWER";

export type MembershipStatus =
  | "INVITED"
  | "ACTIVE"
  | "DISABLED"
  | "EXPIRED";

export type AccessLevel = "READ" | "WRITE" | "APPROVE";

export type InvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "CANCELLED"
  | "EXPIRED";

export type CustomerMembership = {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string;
  customerId: string;
  role: PortalCustomerRole;
  status: MembershipStatus;
  invitedBy: string;
  invitedAt: string;
  acceptedAt: string | null;
  disabledAt: string | null;
  lastPortalLogin: string | null;
  canApproveService: boolean;
  canViewMeters: boolean;
  canViewPm: boolean;
  canDownloadReports: boolean;
  canManageUsers: boolean;
  jobTitle: string;
  phone: string;
  preferredContactMethod: "EMAIL" | "PHONE" | "SMS";
  timeZone: string;
  defaultLocationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerLocationAccess = {
  id: string;
  membershipId: string;
  locationId: string;
  accessLevel: AccessLevel;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPrinterAccess = {
  id: string;
  membershipId: string;
  printerId: string;
  /** CRM asset id or digital twin machine id */
  accessLevel: AccessLevel;
  createdAt: string;
  updatedAt: string;
};

export type PortalInvitation = {
  id: string;
  email: string;
  displayName: string;
  customerId: string;
  role: PortalCustomerRole;
  status: InvitationStatus;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  locationIds: string[];
  printerIds: string[];
  canApproveService: boolean;
  canViewMeters: boolean;
  canViewPm: boolean;
  canDownloadReports: boolean;
  canManageUsers: boolean;
};

export type PortalAnnouncement = {
  id: string;
  title: string;
  message: string;
  customerId: string;
  locationId: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  startDate: string;
  endDate: string | null;
  createdBy: string;
  visible: boolean;
  acknowledgmentRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PortalDocument = {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  customerId: string;
  locationId: string | null;
  printerId: string | null;
  visibleToCustomer: boolean;
  uploadedBy: string;
  uploadedAt: string;
  expirationDate: string | null;
  version: number;
  active: boolean;
};

export type PortalFeedback = {
  id: string;
  ticketId: string;
  membershipId: string;
  rating: number;
  resolutionSatisfaction: number;
  technicianProfessionalism: number;
  communicationQuality: number;
  responseTimeSatisfaction: number;
  comment: string;
  followUpRequested: boolean;
  submittedAt: string;
};

export type PortalMessage = {
  id: string;
  ticketId: string;
  membershipId: string | null;
  senderDisplayName: string;
  body: string;
  createdAt: string;
  visibleToCustomer: boolean;
  attachmentName: string | null;
  readByCustomer: boolean;
};

export type PortalAuditEntry = {
  id: string;
  action: string;
  actor: string;
  membershipId: string | null;
  customerId: string | null;
  entityType: string;
  entityId: string;
  previousValue: string;
  newValue: string;
  sessionInfo: string;
  occurredAt: string;
};

export type PortalNotificationPreference = {
  membershipId: string;
  ticketUpdates: "IMMEDIATE" | "DAILY" | "OFF";
  appointments: "IMMEDIATE" | "DAILY" | "OFF";
  pmUpdates: "IMMEDIATE" | "DAILY" | "OFF";
  reports: "IMMEDIATE" | "DAILY" | "OFF";
  announcements: "IMMEDIATE" | "DAILY" | "OFF";
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  updatedAt: string;
};

export type SupportContactConfig = {
  teamName: string;
  phone: string;
  email: string;
  emergencyPhone: string;
  hours: string;
};

export type PortalDashboardMetrics = {
  activePrinters: number;
  openTickets: number;
  criticalTickets: number;
  technicianScheduled: number;
  waitingForParts: number;
  resolvedThisMonth: number;
  upcomingPMs: number;
  overduePMs: number;
  printersWithAlerts: number;
  newDocuments: number;
  unreadNotifications: number;
};

/** Safe DTO — never includes internal notes / costs / inventory. */
export type PortalPrinterDto = {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  locationId: string;
  locationName: string;
  status: string;
  meter: number | null;
  lastServiceDate: string | null;
  nextPmEstimate: string | null;
  openTicketCount: number;
  coverageStatus: string;
};

export type PortalTicketDto = {
  id: string;
  ticketNumber: string;
  printerId: string;
  printerLabel: string;
  locationName: string;
  problemTitle: string;
  customerStatus: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  scheduledWindow: string;
  technicianName: string;
  resolutionSummary: string;
  partsDelay: string;
};

export type PortalLocationDto = {
  id: string;
  name: string;
  address: string;
  printerCount: number;
  openTicketCount: number;
  upcomingPmCount: number;
  status: string;
};

export type AllowedUploadMime =
  | "image/jpeg"
  | "image/png"
  | "image/heic"
  | "application/pdf"
  | "video/mp4";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
