"use client";

import { useState } from "react";
import { hasMatrixPermission } from "@/lib/auth/permissions";
import { DEV_FALLBACK_ROLE } from "@/lib/auth/types";
import { listWorkOrders } from "@/lib/work-orders";
import {
  captureBrowserQueueSnapshot,
  validateOfficeBrowserRollback,
  type OfficeRollbackValidation,
} from "@/lib/work-orders/office-queue-rollback";
import { MatrixButton, MatrixCard, MatrixEmptyState } from "../components/ui";

export default function WorkOrdersOfficeRollbackCard() {
  const canManage = hasMatrixPermission(DEV_FALLBACK_ROLE, "MANAGE_WORK_ORDERS");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<OfficeRollbackValidation | null>(null);
  const [officeFlagEnabled, setOfficeFlagEnabled] = useState(false);

  if (!canManage) return null;

  async function validateRollback() {
    setLoading(true);
    setError("");
    setValidation(null);
    try {
      const browserWorkOrders = listWorkOrders();
      const snapshotBefore = captureBrowserQueueSnapshot(browserWorkOrders);
      const response = await fetch("/api/work-orders/server-rollback-validation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ browserWorkOrders, snapshotBefore }),
      });
      const body = (await response.json()) as {
        validation?: OfficeRollbackValidation;
        officeFlagEnabled?: boolean;
        guard?: { readyToEnableOfficeFlag: boolean; reasons: string[] };
        error?: string;
      };
      if (!response.ok || !body.guard) {
        throw new Error(body.error ?? "Could not validate browser rollback.");
      }

      const browserAfter = listWorkOrders();
      const snapshotAfter = captureBrowserQueueSnapshot(browserAfter);
      const localValidation = validateOfficeBrowserRollback({
        officeFlagEnabled: Boolean(body.officeFlagEnabled),
        guardReady: body.guard.readyToEnableOfficeFlag,
        guardBlockedReasons: body.guard.readyToEnableOfficeFlag ? [] : body.guard.reasons,
        snapshotBefore,
        snapshotAfter,
        snapshotMatchesRequest: body.validation?.checks.find(
          (check) => check.id === "snapshot-matches-payload",
        )?.pass,
      });

      setValidation(localValidation);
      setOfficeFlagEnabled(Boolean(body.officeFlagEnabled));
    } catch (rollbackError) {
      setError(
        rollbackError instanceof Error
          ? rollbackError.message
          : "Could not validate browser rollback.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <MatrixCard
      title="Browser Rollback Validation"
      subtitle="Step 7 — confirm the browser queue stays intact while MATRIX_SERVER_OFFICE_WORK_ORDERS remains feature-flagged."
    >
      <div className="flex flex-wrap items-center gap-3">
        <MatrixButton variant="secondary" size="sm" disabled={loading} onClick={() => void validateRollback()}>
          {loading ? "Validating…" : "Validate Browser Rollback"}
        </MatrixButton>
        <span className="text-xs text-slate-400">
          Read-only. Does not copy, import, or delete browser or server work orders.
        </span>
      </div>

      {error && (
        <MatrixEmptyState
          title="Rollback validation failed"
          description={error}
          actionLabel="Retry"
          onAction={() => void validateRollback()}
          className="mt-4 py-10"
        />
      )}

      {validation && (
        <div className="mt-4 space-y-3 text-sm">
          <p
            role="status"
            className={
              validation.rollbackReady
                ? "rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 font-semibold text-emerald-200"
                : "rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 font-semibold text-rose-200"
            }
          >
            {validation.rollbackReady
              ? "Browser rollback path validated"
              : "Rollback validation blocked — resolve failing checks before a one-manager pilot"}
          </p>

          <p className="text-xs text-slate-400">
            Office flag:{" "}
            <span className="font-semibold text-slate-200">
              {officeFlagEnabled ? "MATRIX_SERVER_OFFICE_WORK_ORDERS=true" : "false (default)"}
            </span>
            {" · "}
            Effective manager queue:{" "}
            <span className="font-semibold text-slate-200">{validation.managerRollout.indicator}</span>
          </p>

          <ul className="space-y-2 text-xs text-slate-300">
            {validation.checks.map((check) => (
              <li
                key={check.id}
                className={
                  check.pass
                    ? "rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2"
                    : "rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-2 text-rose-100"
                }
              >
                <span className="font-semibold">{check.pass ? "Pass" : "Fail"}:</span> {check.label} —{" "}
                {check.detail}
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
            <p className="font-semibold text-slate-200">Rollback steps</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {validation.rollbackSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </MatrixCard>
  );
}
