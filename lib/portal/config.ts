/**
 * Patch 51B — Customer Portal configuration (organization-scoped).
 */

import { prisma } from "@/lib/db/prisma";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";

export type PortalSettings = {
  portalEnabled: boolean;
  allowCustomerServiceRequests: boolean;
  allowCustomerMeterSubmissions: boolean;
  allowCustomerPartsRequests: boolean;
  allowCustomerPmChangeRequests: boolean;
  allowCustomerUserInvitations: boolean;
  requireInternalApprovalForInvites: boolean;
  defaultPortalRole: "CUSTOMER_USER" | "CUSTOMER_MANAGER" | "CUSTOMER_VIEWER";
  maxAttachmentBytes: number;
  allowedAttachmentTypes: string[];
  showTechnicianName: boolean;
  showScheduledWindow: boolean;
  supportContactName: string;
  supportPhone: string;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
};

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  portalEnabled: true,
  allowCustomerServiceRequests: true,
  allowCustomerMeterSubmissions: true,
  allowCustomerPartsRequests: true,
  allowCustomerPmChangeRequests: true,
  allowCustomerUserInvitations: true,
  requireInternalApprovalForInvites: false,
  defaultPortalRole: "CUSTOMER_USER",
  maxAttachmentBytes: 10 * 1024 * 1024,
  allowedAttachmentTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/plain",
  ],
  showTechnicianName: true,
  showScheduledWindow: true,
  supportContactName: "Matrix Service Desk",
  supportPhone: "+1-555-0140",
  supportEmail: "service@matrix.example",
  termsUrl: "",
  privacyUrl: "",
};

export async function getPortalSettings(
  organizationId = DEFAULT_ORG_ID,
): Promise<PortalSettings> {
  const row = await prisma.portalConfiguration.findUnique({
    where: { organizationId },
  });
  if (!row) return { ...DEFAULT_PORTAL_SETTINGS };
  try {
    return {
      ...DEFAULT_PORTAL_SETTINGS,
      ...(JSON.parse(row.settingsJson) as Partial<PortalSettings>),
    };
  } catch {
    return { ...DEFAULT_PORTAL_SETTINGS };
  }
}

export async function updatePortalSettings(input: {
  organizationId?: string;
  settings: Partial<PortalSettings>;
  actorUserId?: string;
}) {
  const organizationId = input.organizationId ?? DEFAULT_ORG_ID;
  const current = await getPortalSettings(organizationId);
  const next = { ...current, ...input.settings };
  return prisma.portalConfiguration.upsert({
    where: { organizationId },
    create: {
      organizationId,
      settingsJson: JSON.stringify(next),
      updatedByUserId: input.actorUserId ?? null,
    },
    update: {
      settingsJson: JSON.stringify(next),
      updatedByUserId: input.actorUserId ?? null,
    },
  });
}
