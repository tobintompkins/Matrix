"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MatrixButton, MatrixCard } from "../components/ui";
import { useOfficeQueueRollout } from "./useOfficeQueueRollout";
import { createServerOfficeWorkOrder } from "@/lib/work-orders/office-server-mutations";
import {
  createWorkOrder,
  DEFAULT_SERVICE_TYPE_CONFIGS,
  type WorkOrderPriority,
  type WorkOrderServiceType,
} from "@/lib/work-orders";

type Props = {
  serverOfficeQueueEnabled?: boolean;
};

export default function WorkOrderCreateForm({
  serverOfficeQueueEnabled = false,
}: Props) {
  const router = useRouter();
  const { useServerQueue } = useOfficeQueueRollout(serverOfficeQueueEnabled);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("SFX / MPX");
  const [siteName, setSiteName] = useState("SFX/MPX — Portland, Maine");
  const [siteAddress, setSiteAddress] = useState("");
  const [serviceType, setServiceType] =
    useState<WorkOrderServiceType>("BREAK_FIX");
  const [priority, setPriority] = useState<WorkOrderPriority>("NORMAL");
  const [technician, setTechnician] = useState("");
  const [asDraft, setAsDraft] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError("");
    const input = {
      title,
      description,
      customerName,
      siteName,
      siteAddress,
      serviceType,
      priority,
      assignedTechnician: technician,
      createdBy: "Matrix User",
      asDraft,
    };

    if (useServerQueue) {
      const result = await createServerOfficeWorkOrder(input);
      setSubmitting(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/work-orders/${result.workOrder.id}`);
      return;
    }

    const result = createWorkOrder(input);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/work-orders/${result.workOrder.id}`);
  }

  return (
    <MatrixCard
      title="Create Work Order"
      subtitle={
        useServerQueue
          ? "Creates a durable server record when rollout allows the server queue."
          : "Auto-numbers as WO-YYYY-000001 in the browser queue."
      }
    >
      {error && (
        <p className="mb-4 text-sm text-rose-400">{error}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm md:col-span-2">
          <span className="text-slate-400">Title</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-slate-400">Description</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Customer</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Site</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-slate-400">Site address</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Service type</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as WorkOrderServiceType)}
          >
            {DEFAULT_SERVICE_TYPE_CONFIGS.filter((c) => c.active).map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Priority</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={priority}
            onChange={(e) => setPriority(e.target.value as WorkOrderPriority)}
          >
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="text-slate-400">Assigned technician (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={asDraft} onChange={(e) => setAsDraft(e.target.checked)} />
          Save as draft
        </label>
      </div>
      <div className="mt-6 flex gap-3">
        <MatrixButton variant="primary" disabled={submitting} onClick={() => void submit()}>
          {submitting ? "Creating…" : "Create Work Order"}
        </MatrixButton>
      </div>
    </MatrixCard>
  );
}
