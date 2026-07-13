"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MatrixButton, MatrixCard } from "../components/ui";
import {
  createWorkOrder,
  DEFAULT_SERVICE_TYPE_CONFIGS,
  type WorkOrderPriority,
  type WorkOrderServiceType,
} from "@/lib/work-orders";

export default function WorkOrderCreateForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("SFX / MPX");
  const [siteName, setSiteName] = useState("Chicago HQ");
  const [siteAddress, setSiteAddress] = useState("");
  const [serviceType, setServiceType] =
    useState<WorkOrderServiceType>("BREAK_FIX");
  const [priority, setPriority] = useState<WorkOrderPriority>("NORMAL");
  const [technician, setTechnician] = useState("");
  const [asDraft, setAsDraft] = useState(false);

  function submit() {
    const result = createWorkOrder({
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
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/work-orders/${result.workOrder.id}`);
  }

  return (
    <MatrixCard title="Create Work Order" subtitle="Auto-numbers as WO-YYYY-000001">
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
          <span className="text-slate-400">Address</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={siteAddress}
            onChange={(e) => setSiteAddress(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Service Type</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={serviceType}
            onChange={(e) =>
              setServiceType(e.target.value as WorkOrderServiceType)
            }
          >
            {DEFAULT_SERVICE_TYPE_CONFIGS.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
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
          <span className="text-slate-400">Assigned Technician</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={technician}
            onChange={(e) => setTechnician(e.target.value)}
            placeholder="Optional — leave blank for New"
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={asDraft}
            onChange={(e) => setAsDraft(e.target.checked)}
          />
          Save as Draft
        </label>
      </div>
      <div className="mt-6 flex gap-2">
        <MatrixButton variant="primary" size="md" onClick={submit}>
          Create Work Order
        </MatrixButton>
        <MatrixButton href="/work-orders" variant="secondary" size="md">
          Cancel
        </MatrixButton>
      </div>
    </MatrixCard>
  );
}
