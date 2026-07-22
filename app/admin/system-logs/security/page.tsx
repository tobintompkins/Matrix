"use client";

import { Suspense } from "react";
import { SystemLogExplorer } from "../SystemLogExplorer";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <SystemLogExplorer
        title="Security Events"
        subtitle="Potential unauthorized access, permission changes, and other security-relevant activity. Language is investigative, not accusatory."
        apiPath="/api/system-logs/security"
        permission="VIEW_SECURITY_LOGS"
      />
    </Suspense>
  );
}
