/**
 * Patch 51B — Idempotent Prisma seed for portal memberships (from Patch 42 seed).
 */

import { prisma } from "@/lib/db/prisma";
import {
  PORTAL_ANNOUNCEMENTS,
  PORTAL_DOCUMENTS,
  PORTAL_INVITATIONS,
  PORTAL_LOCATION_ACCESS,
  PORTAL_MEMBERSHIPS,
  PORTAL_PRINTER_ACCESS,
} from "./seed";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { DEFAULT_PORTAL_SETTINGS } from "./config";

let seeded = false;

export async function ensurePortalMembershipsSeeded() {
  if (seeded) return;
  const count = await prisma.customerMembership.count();
  if (count === 0) {
    for (const m of PORTAL_MEMBERSHIPS) {
      await prisma.customerMembership.create({
        data: {
          id: m.id,
          clerkUserId: m.clerkUserId,
          email: m.email,
          displayName: m.displayName,
          customerId: m.customerId,
          role: m.role,
          status: m.status,
          invitedBy: m.invitedBy,
          invitedAt: m.invitedAt ? new Date(m.invitedAt) : null,
          acceptedAt: m.acceptedAt ? new Date(m.acceptedAt) : null,
          disabledAt: m.disabledAt ? new Date(m.disabledAt) : null,
          lastPortalLogin: m.lastPortalLogin
            ? new Date(m.lastPortalLogin)
            : null,
          canApproveService: m.canApproveService,
          canViewMeters: m.canViewMeters,
          canViewPm: m.canViewPm,
          canDownloadReports: m.canDownloadReports,
          canManageUsers: m.canManageUsers,
          jobTitle: m.jobTitle,
          phone: m.phone,
          preferredContactMethod: m.preferredContactMethod,
          timeZone: m.timeZone,
          defaultLocationId: m.defaultLocationId,
        },
      });
    }
    for (const row of PORTAL_LOCATION_ACCESS) {
      await prisma.customerLocationAccess.create({
        data: {
          id: row.id,
          membershipId: row.membershipId,
          locationId: row.locationId,
          accessLevel: row.accessLevel,
        },
      });
    }
    for (const row of PORTAL_PRINTER_ACCESS) {
      await prisma.customerPrinterAccess.create({
        data: {
          id: row.id,
          membershipId: row.membershipId,
          printerId: row.printerId,
          accessLevel: row.accessLevel,
        },
      });
    }
  }

  const inviteCount = await prisma.portalInvitation.count();
  if (inviteCount === 0) {
    for (const inv of PORTAL_INVITATIONS) {
      await prisma.portalInvitation.create({
        data: {
          id: inv.id,
          email: inv.email,
          displayName: inv.displayName,
          customerId: inv.customerId,
          role: inv.role,
          status: inv.status,
          invitedBy: inv.invitedBy,
          invitedAt: new Date(inv.invitedAt),
          expiresAt: new Date(inv.expiresAt),
          acceptedAt: inv.acceptedAt ? new Date(inv.acceptedAt) : null,
          cancelledAt: inv.cancelledAt ? new Date(inv.cancelledAt) : null,
          locationIdsJson: JSON.stringify(inv.locationIds),
          printerIdsJson: JSON.stringify(inv.printerIds),
          canApproveService: inv.canApproveService,
          canViewMeters: inv.canViewMeters,
          canViewPm: inv.canViewPm,
          canDownloadReports: inv.canDownloadReports,
          canManageUsers: inv.canManageUsers,
        },
      });
    }
  }

  const annCount = await prisma.portalAnnouncement.count();
  if (annCount === 0) {
    for (const a of PORTAL_ANNOUNCEMENTS) {
      await prisma.portalAnnouncement.create({
        data: {
          id: a.id,
          title: a.title,
          message: a.message,
          customerId: a.customerId,
          locationId: a.locationId,
          priority: a.priority,
          startDate: a.startDate ? new Date(a.startDate) : null,
          endDate: a.endDate ? new Date(a.endDate) : null,
          createdBy: a.createdBy,
          visible: a.visible,
          acknowledgmentRequired: a.acknowledgmentRequired,
        },
      });
    }
  }

  const docCount = await prisma.portalDocument.count();
  if (docCount === 0) {
    for (const d of PORTAL_DOCUMENTS) {
      await prisma.portalDocument.create({
        data: {
          id: d.id,
          title: d.title,
          description: d.description,
          category: d.category,
          fileUrl: d.fileUrl,
          customerId: d.customerId,
          locationId: d.locationId,
          printerId: d.printerId,
          visibleToCustomer: d.visibleToCustomer,
          uploadedBy: d.uploadedBy,
          uploadedAt: new Date(d.uploadedAt),
          expirationDate: d.expirationDate
            ? new Date(d.expirationDate)
            : null,
          version: d.version,
          active: d.active,
        },
      });
    }
  }

  await prisma.portalConfiguration.upsert({
    where: { organizationId: DEFAULT_ORG_ID },
    create: {
      organizationId: DEFAULT_ORG_ID,
      settingsJson: JSON.stringify(DEFAULT_PORTAL_SETTINGS),
    },
    update: {},
  });

  seeded = true;
}
