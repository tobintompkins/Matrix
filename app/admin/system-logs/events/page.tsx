"use client";

import { Suspense } from "react";
import { SystemLogExplorer } from "../SystemLogExplorer";

export default function SystemLogEventsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <SystemLogExplorer
        title="Audit Explorer"
        subtitle="Search and filter administrative and operational events from the existing AuditLog store."
        apiPath="/api/system-logs/events"
        permission="VIEW_SYSTEM_LOGS"
      />
    </Suspense>
  );
}
