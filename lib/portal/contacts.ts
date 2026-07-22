/**
 * Patch 51B — Customer contacts (CRM contacts + support contact) and change requests.
 */

import { listContacts, getCustomer } from "@/lib/crm";
import { prisma } from "@/lib/db/prisma";
import { writeAdminAudit } from "@/lib/admin/repository";
import type { CustomerMembership } from "./types";
import { getSupportContact } from "./repository";
import { DEFAULT_ORG_ID } from "@/lib/admin/types";
import { assertNoInternalLeak } from "./serializers";

export function listPortalContacts(membership: CustomerMembership) {
  const customer = getCustomer(membership.customerId);
  const support = getSupportContact();
  const crmContacts = listContacts(membership.customerId)
    .slice(0, 50)
    .map((c) => ({
      id: c.id,
      name: c.name,
      role: c.jobTitle || c.department || "Contact",
      phone: c.mobilePhone || c.officePhone || null,
      email: c.email || null,
      isPrimary: Boolean(c.isPrimary),
      source: "customer" as const,
    }));

  const serviceContacts = [
    {
      id: "support-primary",
      name: support.teamName,
      role: "Assigned Service Team",
      phone: support.phone,
      email: support.email,
      isPrimary: true,
      source: "service" as const,
    },
    ...(support.emergencyPhone
      ? [
          {
            id: "support-emergency",
            name: support.teamName,
            role: "Emergency Service Contact",
            phone: support.emergencyPhone,
            email: support.email,
            isPrimary: false,
            source: "service" as const,
          },
        ]
      : []),
  ];

  const out = {
    customerName: customer?.name ?? membership.customerId,
    contacts: [...serviceContacts, ...crmContacts],
  };
  assertNoInternalLeak(out);
  return out;
}

export async function submitContactChangeRequest(input: {
  membership: CustomerMembership;
  contactId?: string | null;
  name?: string;
  phone?: string;
  email?: string;
  jobTitle?: string;
  note?: string;
  organizationId?: string;
}) {
  const change = await prisma.customerChangeRequest.create({
    data: {
      organizationId: input.organizationId ?? DEFAULT_ORG_ID,
      customerId: input.membership.customerId,
      membershipId: input.membership.id,
      requestType: "CONTACT_UPDATE",
      payloadJson: JSON.stringify({
        contactId: input.contactId ?? null,
        name: input.name ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        jobTitle: input.jobTitle ?? null,
        note: input.note ?? null,
      }),
      status: "PENDING",
    },
  });

  await writeAdminAudit({
    organizationId: input.organizationId ?? DEFAULT_ORG_ID,
    actorId: input.membership.clerkUserId,
    action: "PORTAL_CONTACT_CHANGE_REQUESTED",
    entityType: "CustomerChangeRequest",
    entityId: change.id,
    payload: { customerId: input.membership.customerId },
  });

  return {
    ok: true as const,
    requestId: change.id,
    message:
      "Your contact update was submitted for review and will not change records until approved.",
  };
}
