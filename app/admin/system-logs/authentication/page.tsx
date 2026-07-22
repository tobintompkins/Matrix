"use client";

import { Suspense } from "react";
import { SystemLogExplorer } from "../SystemLogExplorer";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <SystemLogExplorer
        title="Authentication"
        subtitle="Authentication activity recorded in Matrix AuditLog. Clerk does not provide password or session token values."
        apiPath="/api/system-logs/authentication"
        permission="VIEW_AUTHENTICATION_LOGS"
        fixedCategory="AUTHENTICATION"
      />
    </Suspense>
  );
}
