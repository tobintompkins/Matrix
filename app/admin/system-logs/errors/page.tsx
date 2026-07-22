"use client";

import { Suspense } from "react";
import { SystemLogExplorer } from "../SystemLogExplorer";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-400">Loading…</p>}>
      <SystemLogExplorer
        title="Application Errors"
        subtitle="Error and failure events from the existing audit trail."
        apiPath="/api/system-logs/errors"
        permission="VIEW_ERROR_LOGS"
        fixedCategory="ERROR"
      />
    </Suspense>
  );
}
