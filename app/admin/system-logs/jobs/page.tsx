"use client";

import { Suspense } from "react";
import { SystemLogExplorer } from "../SystemLogExplorer";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <SystemLogExplorer
        title="Background Jobs"
        subtitle="Job-related AuditLog events. No durable scheduler is installed."
        apiPath="/api/system-logs/jobs"
        permission="VIEW_JOB_LOGS"
        fixedCategory="BACKGROUND_JOB"
      />
    </Suspense>
  );
}
