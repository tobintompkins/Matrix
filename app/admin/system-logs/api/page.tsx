"use client";

import { Suspense } from "react";
import { SystemLogExplorer } from "../SystemLogExplorer";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <SystemLogExplorer
        title="API Activity"
        subtitle="API-related AuditLog events. Full request/response bodies are not stored by default."
        apiPath="/api/system-logs/api"
        permission="VIEW_API_LOGS"
        fixedCategory="API"
      />
    </Suspense>
  );
}
