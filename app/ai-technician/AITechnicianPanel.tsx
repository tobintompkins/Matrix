"use client";

import { useMemo } from "react";
import MatrixAssistPanel from "@/app/components/matrix-assist/MatrixAssistPanel";
import { MatrixPageHeader } from "@/app/components/ui";
import { useWorkflowContext } from "@/lib/workflow/use-workflow-context";
import { MATRIX_ASSIST_SUBTITLE } from "@/lib/matrix-assist/constants";

const ticketAssetMap: Record<string, string> = {
  "TKT-2026-0142": "MX-GD-002",
  "TKT-2026-0138": "MX-VA-002",
  "TKT-2026-0135": "MX-GL-001",
};

export default function AITechnicianPanel() {
  const workflowContext = useWorkflowContext();
  const machineId = useMemo(() => {
    if (workflowContext.assetId) return workflowContext.assetId;
    if (workflowContext.ticket && ticketAssetMap[workflowContext.ticket]) {
      return ticketAssetMap[workflowContext.ticket];
    }
    return undefined;
  }, [workflowContext.assetId, workflowContext.ticket]);

  const serviceCallId = workflowContext.ticket || undefined;

  return (
    <div className="space-y-6">
      <MatrixPageHeader
        title="Matrix Assist"
        subtitle={MATRIX_ASSIST_SUBTITLE}
        breadcrumbs={["Matrix", "Knowledge", "Matrix Assist"]}
      />
      <MatrixAssistPanel
        serviceCallId={serviceCallId}
        machineId={machineId}
      />
    </div>
  );
}
