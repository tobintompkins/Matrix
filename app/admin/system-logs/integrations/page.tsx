"use client";

import { Suspense } from "react";
import { SystemLogExplorer } from "../SystemLogExplorer";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <SystemLogExplorer
        title="Integrations"
        subtitle="Integration and webhook activity recorded in AuditLog."
        apiPath="/api/system-logs/integrations"
        permission="VIEW_INTEGRATION_LOGS"
        fixedCategory="INTEGRATION"
      />
    </Suspense>
  );
}
