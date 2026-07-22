import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/portal/auth";
import { getNotificationPrefs, saveNotificationPrefs } from "@/lib/portal/enterprise";
import { setActivePortalMembership } from "@/lib/portal/repository";
import { listPortalAnnouncements } from "@/lib/portal/enterprise";
import { buildPortalCustomerContext } from "@/lib/portal/customer-context";
import {
  markNotificationRead,
  listNotifications,
} from "@/lib/notifications";
import {
  isPortalInboxNotificationType,
  notificationTargetsMembership,
} from "@/lib/portal/notification-targets";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_NOTIFICATIONS");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);

  const announcements = listPortalAnnouncements();
  const ctx = await buildPortalCustomerContext(gate.membership);
  const ticketItems = ctx.notifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    priority: "NORMAL",
    createdAt: n.createdAt,
    type: "TICKET_EVENT",
    read: n.read,
    href: n.href || "/portal/tickets",
  }));
  const announcementItems = announcements.map((a) => ({
    id: `ann-${a.id}`,
    title: a.title,
    message: a.message,
    priority: a.priority,
    createdAt: a.createdAt,
    type: "ANNOUNCEMENT",
    read: false,
    href: "/portal/announcements",
  }));

  const items = [...ticketItems, ...announcementItems].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return NextResponse.json({
    ok: true,
    preferences: getNotificationPrefs(),
    unreadCount: items.filter((i) => !i.read).length,
    items,
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await requirePortalAccess("VIEW_CUSTOMER_NOTIFICATIONS");
  if (!gate.ok) return gate.response;
  setActivePortalMembership(gate.membership.id);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  if (body.action === "markAllRead") {
    const mine = listNotifications().filter(
      (n) =>
        notificationTargetsMembership(n.userIds, gate.membership) &&
        isPortalInboxNotificationType(n.type) &&
        !n.readAt,
    );
    let marked = 0;
    for (const n of mine) {
      if (markNotificationRead(n.id, gate.membership.displayName)) marked += 1;
    }
    return NextResponse.json({ ok: true, marked });
  }

  if (body.action === "markRead" && typeof body.id === "string") {
    const mine = listNotifications().find(
      (n) =>
        n.id === body.id &&
        notificationTargetsMembership(n.userIds, gate.membership),
    );
    if (!mine) {
      return NextResponse.json(
        { ok: false, error: "Notification not found." },
        { status: 404 },
      );
    }
    const item = markNotificationRead(body.id, gate.membership.displayName);
    return NextResponse.json({ ok: Boolean(item), item });
  }

  if (body.preferences && typeof body.preferences === "object") {
    const r = saveNotificationPrefs(
      body.preferences as Parameters<typeof saveNotificationPrefs>[0],
    );
    return NextResponse.json(r);
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
