"use client";

import { useSearchParams } from "next/navigation";
import { parseWorkflowContext } from "./routes";
import type { WorkflowContext } from "./types";

export function useWorkflowContext(): WorkflowContext {
  const searchParams = useSearchParams();
  return parseWorkflowContext(searchParams);
}
