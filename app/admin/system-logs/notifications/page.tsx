"use client";

import { Suspense } from "react";
import { SystemLogExplorer } from "../SystemLogExplorer";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <SystemLogExplorer
        title="Notifications"
        subtitle="Notification-related AuditLog events. Delivery confirmation is Not Available for the session-local in-app store."
        apiPath="/api/system-logs/notifications"
        permission="VIEW_NOTIFICATION_LOGS"
        fixedCategory="NOTIFICATION"
      />
    </Suspense>
  );
}
