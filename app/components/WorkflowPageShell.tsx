"use client";

import { Suspense, type ReactNode } from "react";
import WorkflowChain from "./WorkflowChain";
import WorkflowContextBanner from "./WorkflowContextBanner";
import type { WorkflowContext, WorkflowModule } from "@/lib/workflow/types";

type WorkflowPageShellProps = {
  current?: WorkflowModule;
  context?: WorkflowContext;
  children: ReactNode;
};

export default function WorkflowPageShell({
  current,
  context,
  children,
}: WorkflowPageShellProps) {
  return (
    <Suspense fallback={null}>
      <WorkflowContextBanner />
      {current ? (
        <WorkflowChain current={current} context={context} className="mb-6" />
      ) : null}
      {children}
    </Suspense>
  );
}
