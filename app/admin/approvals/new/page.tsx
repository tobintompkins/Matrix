"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AdminShell from "../../../components/admin/AdminShell";
import { MatrixCard } from "../../../components/ui";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import { getApprovalType, listApprovalTypes } from "@/lib/approvals/registry";

export default function NewApprovalPage() {
  const router = useRouter();
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canCreate = hasMatrixPermission(role, "CREATE_APPROVAL_REQUEST");
  const types = useMemo(() => listApprovalTypes(), []);

  const [title, setTitle] = useState("");
  const [approvalType, setApprovalType] = useState("GENERAL_REQUEST");
  const [priority, setPriority] = useState("NORMAL");
  const [description, setDescription] = useState("");
  const [businessJustification, setBusinessJustification] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dueAt, setDueAt] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [machineId, setMachineId] = useState("");
  const [serviceCallId, setServiceCallId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descriptor = getApprovalType(approvalType);
  const fields = descriptor?.fields ?? [];

  async function save(submit: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          approvalType,
          priority,
          description,
          businessJustification,
          requestedAmount: requestedAmount ? Number(requestedAmount) : null,
          currency,
          dueAt: dueAt || null,
          customerId: customerId || null,
          machineId: machineId || null,
          serviceCallId: serviceCallId || null,
          requesterDepartmentId: departmentId || null,
          sourceModule: descriptor?.sourceModule ?? null,
          submit,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Create failed");
      router.push(`/admin/approvals/${json.item.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canCreate) {
    return (
      <AdminShell title="New approval request" subtitle="">
        <p className="text-sm text-rose-300" role="alert">
          You do not have permission to create approval requests.
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="New approval request"
      subtitle="Create a draft or submit for workflow evaluation."
    >
      <div className="mb-4">
        <Link href="/admin/approvals" className="text-sm text-sky-400 hover:underline">
          ← Approval Center
        </Link>
      </div>

      <MatrixCard title="Request">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-400 md:col-span-2">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              required
            />
          </label>
          <label className="text-sm text-slate-400">
            Approval type
            <select
              value={approvalType}
              onChange={(e) => setApprovalType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {types.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-400">
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {["CRITICAL", "HIGH", "NORMAL", "LOW"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-400 md:col-span-2">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          {fields.includes("businessJustification") ? (
            <label className="text-sm text-slate-400 md:col-span-2">
              Business justification
              <textarea
                value={businessJustification}
                onChange={(e) => setBusinessJustification(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ) : null}
          {fields.includes("requestedAmount") ? (
            <label className="text-sm text-slate-400">
              Requested amount
              <input
                type="number"
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ) : null}
          {fields.includes("currency") ? (
            <label className="text-sm text-slate-400">
              Currency
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ) : null}
          {fields.includes("dueAt") ? (
            <label className="text-sm text-slate-400">
              Due date
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ) : null}
          <label className="text-sm text-slate-400">
            Department ID
            <input
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          {fields.includes("customerId") ? (
            <label className="text-sm text-slate-400">
              Linked customer ID
              <input
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ) : null}
          {fields.includes("machineId") ? (
            <label className="text-sm text-slate-400">
              Linked machine ID
              <input
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ) : null}
          {fields.includes("serviceCallId") ? (
            <label className="text-sm text-slate-400">
              Linked service call ID
              <input
                value={serviceCallId}
                onChange={(e) => setServiceCallId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() => void save(false)}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() => void save(true)}
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Submit for approval
          </button>
        </div>
      </MatrixCard>
    </AdminShell>
  );
}
