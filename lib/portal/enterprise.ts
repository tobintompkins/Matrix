/**
 * Patch 51B — Portal API helpers wrapping existing repository + serializers.
 */

import {
  getPortalDashboard,
  getPortalPrinter,
  getPortalProfile,
  getPortalTicket,
  listPortalAnnouncements,
  listPortalDocuments,
  listPortalPrinters,
  listPortalTickets,
  createPortalTicket,
  addPortalMessage,
  updatePortalProfile,
  createInvitation,
  disableMembership,
  listMembershipsForCustomer,
  listPendingInvitations,
  downloadPortalDocument,
  getNotificationPrefs,
  saveNotificationPrefs,
  setActivePortalMembership,
  getAuthorizedPrinterIds,
} from "./repository";
import type { CustomerMembership } from "./types";
import {
  serializePortalDocument,
  serializePortalEquipment,
  serializePortalTicket,
} from "./serializers";
import { getPortalSettings } from "./config";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { writeAdminAudit } from "@/lib/admin/repository";
import { mapPmStatusForPortal } from "./serializers";
import { listMeterTableRows } from "@/lib/pm-intelligence";
import { listPortalPartsRequests } from "./parts";

export function activateMembership(membership: CustomerMembership) {
  setActivePortalMembership(membership.id);
}

export async function portalMe(membership: CustomerMembership, organizationId: string) {
  activateMembership(membership);
  const settings = await getPortalSettings(organizationId);
  const profile = getPortalProfile();
  return {
    membership: {
      id: membership.id,
      displayName: membership.displayName,
      email: membership.email,
      role: membership.role,
      status: membership.status,
      customerId: membership.customerId,
      canApproveService: membership.canApproveService,
      canViewMeters: membership.canViewMeters,
      canViewPm: membership.canViewPm,
      canDownloadReports: membership.canDownloadReports,
      canManageUsers: membership.canManageUsers,
    },
    profile: profile
      ? {
          phone: profile.phone,
          jobTitle: profile.jobTitle,
          preferredContactMethod: profile.preferredContactMethod,
          timeZone: profile.timeZone,
          defaultLocationId: profile.defaultLocationId,
        }
      : null,
    settings: {
      portalEnabled: settings.portalEnabled,
      allowCustomerServiceRequests: settings.allowCustomerServiceRequests,
      allowCustomerMeterSubmissions: settings.allowCustomerMeterSubmissions,
      allowCustomerPartsRequests: settings.allowCustomerPartsRequests,
      allowCustomerPmChangeRequests: settings.allowCustomerPmChangeRequests,
      showTechnicianName: settings.showTechnicianName,
      showScheduledWindow: settings.showScheduledWindow,
      supportContactName: settings.supportContactName,
      supportPhone: settings.supportPhone,
      supportEmail: settings.supportEmail,
      termsUrl: settings.termsUrl,
      privacyUrl: settings.privacyUrl,
    },
  };
}

export async function portalDashboard(
  membership: CustomerMembership,
  organizationId = DEFAULT_ORG_ID,
) {
  activateMembership(membership);
  const settings = await getPortalSettings(organizationId);
  const dash = getPortalDashboard();
  const tickets = listPortalTickets().slice(0, 8).map((t) =>
    serializePortalTicket(t, {
      showTechnicianName: settings.showTechnicianName,
      showScheduledWindow: settings.showScheduledWindow,
    }),
  );
  const equipment = listPortalPrinters()
    .slice(0, 8)
    .map((p) =>
      serializePortalEquipment(p, { includeMeter: membership.canViewMeters }),
    );

  const allowed = new Set(getAuthorizedPrinterIds(membership));
  const pmRows = listMeterTableRows()
    .filter((r) => allowed.has(r.printerId))
    .slice(0, 8)
    .map((r) => ({
      machineId: r.printerId,
      machineName: r.machineName,
      locationName: r.siteName,
      pmType: "Preventive Maintenance",
      status: mapPmStatusForPortal(r.pmStatus),
      nextPmMeter: r.nextPmCount,
      currentMeter: r.currentMeter,
      estimatedDate: r.estimatedPmDate,
    }));

  let openPartsRequests = 0;
  try {
    const parts = await listPortalPartsRequests(membership);
    openPartsRequests = parts.filter(
      (p) => !["Rejected", "Cancelled", "Delivered"].includes(p.status),
    ).length;
  } catch {
    openPartsRequests = 0;
  }

  return {
    metrics: {
      openServiceRequests: dash?.openTickets ?? 0,
      equipmentOnline: dash?.activePrinters ?? 0,
      equipmentAttention: dash?.printersWithAlerts ?? 0,
      upcomingPmVisits: dash?.upcomingPMs ?? 0,
      overduePmItems: dash?.overduePMs ?? 0,
      meterReadingsDue: 0,
      openPartsRequests,
      unreadNotifications: dash?.unreadNotifications ?? 0,
      criticalTickets: dash?.criticalTickets ?? 0,
    },
    recentServiceRequests: tickets,
    equipmentHealth: equipment,
    upcomingPm: pmRows,
    announcements: listPortalAnnouncements().slice(0, 5),
  };
}

export async function portalListServiceRequests(
  membership: CustomerMembership,
  organizationId = DEFAULT_ORG_ID,
) {
  activateMembership(membership);
  const settings = await getPortalSettings(organizationId);
  return listPortalTickets().map((t) =>
    serializePortalTicket(t, {
      showTechnicianName: settings.showTechnicianName,
      showScheduledWindow: settings.showScheduledWindow,
    }),
  );
}

export async function portalGetServiceRequest(
  membership: CustomerMembership,
  id: string,
  organizationId = DEFAULT_ORG_ID,
) {
  activateMembership(membership);
  const settings = await getPortalSettings(organizationId);
  const detail = getPortalTicket(id);
  if (!detail.ok) return detail;
  return {
    ok: true as const,
    ticket: serializePortalTicket(detail.ticket, {
      showTechnicianName: settings.showTechnicianName,
      showScheduledWindow: settings.showScheduledWindow,
    }),
    activity: detail.activity,
    messages: detail.messages.map((m) => ({
      id: m.id,
      body: m.body,
      author: m.senderDisplayName,
      createdAt: m.createdAt,
      attachmentName: m.attachmentName,
    })),
  };
}

export async function portalCreateServiceRequest(
  membership: CustomerMembership,
  body: Record<string, unknown>,
  organizationId = DEFAULT_ORG_ID,
) {
  activateMembership(membership);
  const settings = await getPortalSettings(organizationId);
  if (!settings.allowCustomerServiceRequests) {
    return { ok: false as const, error: "Service requests are disabled." };
  }
  const result = createPortalTicket({
    printerAssetId: String(body.machineId ?? body.printerAssetId ?? ""),
    problemCategory: String(body.issueCategory ?? body.problemCategory ?? "Other"),
    problemTitle: String(body.issueSummary ?? body.problemTitle ?? ""),
    description: String(body.description ?? ""),
    productionImpact: String(
      body.businessImpact ?? body.productionImpact ?? "Normal operations",
    ),
    machineOperational:
      String(body.machineOperationalStatus ?? "") !== "Completely Down",
    errorCode: String(body.errorCode ?? ""),
    preferredDate: String(body.preferredServiceWindow ?? body.preferredDate ?? ""),
    preferredWindow: String(body.preferredServiceWindow ?? body.preferredWindow ?? ""),
    contactName: String(body.preferredContact ?? membership.displayName),
    contactEmail: String(body.contactEmail ?? membership.email),
    contactPhone: String(body.contactPhone ?? membership.phone),
    confirmSeparateProblem: Boolean(body.confirmSeparateProblem),
  });

  if (result.ok && "ticketId" in result) {
    await writeAdminAudit({
      organizationId,
      actorId: membership.clerkUserId,
      action: "PORTAL_SERVICE_REQUEST_CREATED",
      entityType: "ServiceCall",
      entityId: String((result as { ticketId?: string }).ticketId ?? ""),
      payload: { customerId: membership.customerId },
    });
  }
  return result;
}

export function portalListEquipment(membership: CustomerMembership) {
  activateMembership(membership);
  return listPortalPrinters().map((p) =>
    serializePortalEquipment(p, { includeMeter: membership.canViewMeters }),
  );
}

export function portalGetEquipment(membership: CustomerMembership, id: string) {
  activateMembership(membership);
  const row = getPortalPrinter(id);
  if (!row.ok) return row;
  return {
    ok: true as const,
    item: serializePortalEquipment(row.printer, {
      includeMeter: membership.canViewMeters,
    }),
  };
}

export function portalListDocuments(membership: CustomerMembership) {
  activateMembership(membership);
  return listPortalDocuments()
    .filter((d) => d.visibleToCustomer && d.active)
    .map((d) => serializePortalDocument(d));
}

export async function portalDownloadDocument(
  membership: CustomerMembership,
  id: string,
  organizationId = DEFAULT_ORG_ID,
) {
  activateMembership(membership);
  const result = downloadPortalDocument(id);
  if (result.ok) {
    await writeAdminAudit({
      organizationId,
      actorId: membership.clerkUserId,
      action: "PORTAL_DOCUMENT_DOWNLOADED",
      entityType: "PortalDocument",
      entityId: id,
      payload: { customerId: membership.customerId },
    });
  }
  return result;
}

export {
  addPortalMessage,
  updatePortalProfile,
  createInvitation,
  disableMembership,
  listMembershipsForCustomer,
  listPendingInvitations,
  getNotificationPrefs,
  saveNotificationPrefs,
  listPortalAnnouncements,
};
