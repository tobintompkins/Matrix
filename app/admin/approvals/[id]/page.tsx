"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixCard, MatrixStatusBadge } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import { approvalBadgeVariant } from "@/lib/approvals/badge";

type ApprovalDetail = {
  id: string;
  requestNumber: string;
  title: string;
  description: string | null;
  businessJustification: string | null;
  approvalType: string;
  sourceModule: string | null;
  sourceRecordId: string | null;
  status: string;
  priority: string;
  requesterName: string | null;
  requesterDepartmentId: string | null;
  currentStepNumber: number;
  totalSteps: number;
  assignedApproverName: string | null;
  requestedAmount: number | null;
  currency: string | null;
  submittedAt: string | null;
  dueAt: string | null;
  waitingTime: string;
  sla: string;
  overdue: boolean;
  customerId: string | null;
  machineId: string | null;
  serviceCallId: string | null;
  partsOrderId: string | null;
  steps: Array<{
    id: string;
    stepNumber: number;
    name: string;
    status: string;
    assignedUserName: string | null;
    dueAt: string | null;
  }>;
  decisions: Array<{
    id: string;
    decision: string;
    decidedByName: string | null;
    decidedByRoleName: string | null;
    comment: string | null;
    signatureHash: string;
    decidedAt: string;
  }>;
  assignments: Array<{
    id: string;
    assignmentType: string;
    assignedToName: string | null;
    assignedByName: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    parentCommentId: string | null;
    authorName: string | null;
    authorRole: string | null;
    body: string;
    isInternal: boolean;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
  }>;
};

export default function ApprovalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_APPROVAL_CENTER");
  const [item, setItem] = useState<ApprovalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView || !params.id) return;
    setError(null);
    try {
      const res = await fetch(`/api/approvals/${params.id}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to load");
      setItem(json.item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [canView, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    path: string,
    body?: Record<string, unknown>,
    requireReason = false,
  ) {
    if (requireReason && !reason.trim()) {
      setMessage("A reason is required for this action.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/approvals/${params.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          reason: reason || undefined,
          instructions: reason || undefined,
          comment: reason || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Action failed");
      setReason("");
      setMessage("Action completed.");
      await load();
      if (path === "cancel" || path === "archive") {
        router.push("/admin/approvals");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function postComment() {
    if (!commentBody.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/approvals/${params.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Comment failed");
      setCommentBody("");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Comment failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <AdminShell title="Approval detail" subtitle="">
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to view approvals.
        </p>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell title="Approval detail" subtitle="">
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
        <Link href="/admin/approvals" className="mt-3 inline-block text-sky-400">
          Back to queue
        </Link>
      </AdminShell>
    );
  }

  if (!item) {
    return (
      <AdminShell title="Approval detail" subtitle="">
        <p className="text-sm text-slate-400">Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title={item.requestNumber}
      subtitle={item.title}
    >
      <div className="mb-4">
        <Link href="/admin/approvals" className="text-sm text-sky-400 hover:underline">
          ← Approval Center
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <MatrixStatusBadge
          variant={approvalBadgeVariant(item.status)}
          label={item.status}
        />
        <MatrixStatusBadge
          variant={approvalBadgeVariant(item.priority)}
          label={item.priority}
        />
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
          SLA: {item.sla}
        </span>
        <span className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">
          Waiting: {item.waitingTime}
        </span>
        {item.overdue ? (
          <span className="rounded bg-rose-900/50 px-2 py-1 text-xs text-rose-200">
            Overdue
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <MatrixCard title="Request details">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Type</dt>
                <dd className="text-slate-100">{item.approvalType}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Source module</dt>
                <dd className="text-slate-100">{item.sourceModule ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Requester</dt>
                <dd className="text-slate-100">{item.requesterName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Department</dt>
                <dd className="text-slate-100">
                  {item.requesterDepartmentId ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Current step</dt>
                <dd className="text-slate-100">
                  {item.currentStepNumber} / {item.totalSteps}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Current approver</dt>
                <dd className="text-slate-100">
                  {item.assignedApproverName ?? "Unassigned"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Submitted</dt>
                <dd className="text-slate-100">
                  {item.submittedAt
                    ? new Date(item.submittedAt).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Due</dt>
                <dd className="text-slate-100">
                  {item.dueAt ? new Date(item.dueAt).toLocaleString() : "—"}
                </dd>
              </div>
              {item.requestedAmount != null ? (
                <div>
                  <dt className="text-slate-400">Requested amount</dt>
                  <dd className="text-slate-100">
                    {item.currency ?? "USD"}{" "}
                    {item.requestedAmount.toLocaleString()}
                  </dd>
                </div>
              ) : null}
            </dl>
            {item.description ? (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-300">Description</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                  {item.description}
                </p>
              </div>
            ) : null}
            {item.businessJustification ? (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-300">
                  Business justification
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                  {item.businessJustification}
                </p>
              </div>
            ) : null}
          </MatrixCard>

          {(item.customerId ||
            item.machineId ||
            item.serviceCallId ||
            item.partsOrderId ||
            item.sourceRecordId) && (
            <MatrixCard title="Linked records">
              <ul className="space-y-1 text-sm text-slate-200">
                {item.customerId ? <li>Customer: {item.customerId}</li> : null}
                {item.machineId ? <li>Machine: {item.machineId}</li> : null}
                {item.serviceCallId ? (
                  <li>Service call: {item.serviceCallId}</li>
                ) : null}
                {item.partsOrderId ? (
                  <li>Parts order: {item.partsOrderId}</li>
                ) : null}
                {item.sourceRecordId ? (
                  <li>Source record: {item.sourceRecordId}</li>
                ) : null}
              </ul>
            </MatrixCard>
          )}

          <MatrixCard title="Workflow steps">
            <ol className="space-y-2 text-sm">
              {item.steps.map((step) => (
                <li
                  key={step.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-3 py-2"
                >
                  <span>
                    {step.stepNumber}. {step.name}
                    {step.assignedUserName
                      ? ` — ${step.assignedUserName}`
                      : ""}
                  </span>
                  <MatrixStatusBadge
                    variant={approvalBadgeVariant(step.status)}
                    label={step.status}
                  />
                </li>
              ))}
            </ol>
          </MatrixCard>

          <MatrixCard title="Decision history">
            {item.decisions.length === 0 ? (
              <p className="text-sm text-slate-400">No decisions yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {item.decisions.map((d) => (
                  <li key={d.id} className="border-b border-slate-800 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <MatrixStatusBadge
                        variant={approvalBadgeVariant(d.decision)}
                        label={d.decision}
                      />
                      <span className="text-slate-200">
                        {d.decidedByName}
                        {d.decidedByRoleName ? ` (${d.decidedByRoleName})` : ""}
                      </span>
                      <span className="text-slate-500">
                        {new Date(d.decidedAt).toLocaleString()}
                      </span>
                    </div>
                    {d.comment ? (
                      <p className="mt-1 text-slate-300">{d.comment}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-[10px] text-slate-500">
                      Digital verification: {d.signatureHash.slice(0, 16)}…
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </MatrixCard>

          {item.assignments.length > 0 ? (
            <MatrixCard title="Assignments">
              <ul className="space-y-2 text-sm text-slate-300">
                {item.assignments.map((a) => (
                  <li key={a.id}>
                    {a.assignmentType}: {a.assignedToName ?? "—"} by{" "}
                    {a.assignedByName ?? "—"}
                    {a.reason ? ` — ${a.reason}` : ""}
                    <span className="ml-2 text-slate-500">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </MatrixCard>
          ) : null}

          <MatrixCard title="Comments">
            <ul className="mb-4 space-y-3 text-sm">
              {item.comments.map((c) => (
                <li
                  key={c.id}
                  className={c.parentCommentId ? "ml-4 border-l border-slate-700 pl-3" : ""}
                >
                  <div className="text-slate-400">
                    {c.authorName}
                    {c.authorRole ? ` · ${c.authorRole}` : ""}
                    {" · "}
                    {new Date(c.createdAt).toLocaleString()}
                    {c.isInternal ? " · Internal" : ""}
                  </div>
                  <p className="text-slate-100">{c.body}</p>
                </li>
              ))}
            </ul>
            {hasMatrixPermission(role, "COMMENT_ON_APPROVAL") ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="Add a comment…"
                  aria-label="Comment body"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void postComment()}
                  className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Comment
                </button>
              </div>
            ) : null}
          </MatrixCard>

          {item.attachments.length > 0 ? (
            <MatrixCard title="Attachments">
              <ul className="text-sm text-sky-300">
                {item.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={a.fileUrl} className="hover:underline">
                      {a.fileName}
                    </a>
                  </li>
                ))}
              </ul>
            </MatrixCard>
          ) : null}
        </div>

        <div className="space-y-4">
          <MatrixCard title="Actions">
            <label className="mb-3 block text-sm text-slate-400">
              Reason / comment
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <div className="flex flex-col gap-2">
              {hasMatrixPermission(role, "APPROVE_REQUEST") ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("approve")}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Approve Request
                </button>
              ) : null}
              {hasMatrixPermission(role, "REJECT_REQUEST") ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("reject", undefined, true)}
                  className="rounded-lg bg-rose-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Reject Request
                </button>
              ) : null}
              {hasMatrixPermission(role, "RETURN_APPROVAL_FOR_REVISION") ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("return", undefined, true)}
                  className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-200 disabled:opacity-50"
                >
                  Return for Revision
                </button>
              ) : null}
              {item.status === "DRAFT" ||
              item.status === "RETURNED_FOR_REVISION" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("submit")}
                  className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                >
                  Submit for Approval
                </button>
              ) : null}
              {hasMatrixPermission(role, "CANCEL_APPROVAL") ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("cancel", undefined, true)}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                >
                  Cancel Request
                </button>
              ) : null}
              {hasMatrixPermission(role, "ARCHIVE_APPROVALS") ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction("archive")}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                >
                  Archive
                </button>
              ) : null}
            </div>

            {hasMatrixPermission(role, "ASSIGN_APPROVAL_REVIEWER") ? (
              <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                <label className="block text-sm text-slate-400">
                  Assign reviewer user ID
                  <input
                    value={assigneeUserId}
                    onChange={(e) => setAssigneeUserId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !assigneeUserId.trim()}
                  onClick={() =>
                    void runAction("assign", {
                      assigneeUserId,
                      reason: reason || "Assigned via Approval Center",
                    })
                  }
                  className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                >
                  Assign Reviewer
                </button>
                {hasMatrixPermission(role, "DELEGATE_APPROVAL") ? (
                  <button
                    type="button"
                    disabled={busy || !assigneeUserId.trim()}
                    onClick={() =>
                      void runAction("delegate", {
                        delegateUserId: assigneeUserId,
                        reason: reason || "Delegated via Approval Center",
                      })
                    }
                    className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                  >
                    Delegate Review
                  </button>
                ) : null}
                {hasMatrixPermission(role, "ESCALATE_APPROVAL") ? (
                  <button
                    type="button"
                    disabled={busy || !assigneeUserId.trim()}
                    onClick={() =>
                      void runAction(
                        "escalate",
                        { escalateToUserId: assigneeUserId },
                        true,
                      )
                    }
                    className="w-full rounded-lg border border-rose-700 px-3 py-2 text-sm text-rose-200 disabled:opacity-50"
                  >
                    Escalate Request
                  </button>
                ) : null}
              </div>
            ) : null}

            {message ? (
              <p className="mt-3 text-sm text-slate-300" role="status">
                {message}
              </p>
            ) : null}
          </MatrixCard>
        </div>
      </div>
    </AdminShell>
  );
}
