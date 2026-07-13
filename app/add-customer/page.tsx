"use client";

import { useState } from "react";
import MatrixShell from "../components/MatrixShell";
import {
  MatrixButton,
  MatrixCard,
  MatrixPageHeader,
} from "../components/ui";
import { createCustomer, type CustomerStatus } from "@/lib/crm";

export default function AddCustomerPage() {
  const [name, setName] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("PROSPECT");
  const [primaryAddress, setPrimaryAddress] = useState("");
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = createCustomer({
      name: name.trim(),
      customerNumber:
        customerNumber.trim() || `CUST-${Date.now().toString(36).toUpperCase()}`,
      status,
      industry: industry.trim(),
      parentCustomerId: null,
      taxId: null,
      billingAddress: primaryAddress.trim(),
      primaryAddress: primaryAddress.trim(),
      notes: "",
      website: "",
      timeZone: "America/New_York",
      preferredBusinessHours: "Mon–Fri 08:00–17:00",
    });
    if (!result.ok || !result.customer) {
      setError(result.error ?? "Could not create customer.");
      return;
    }
    setCreatedId(result.customer.id);
    window.location.href = `/customers/${result.customer.id}`;
  }

  return (
    <MatrixShell title="Add Customer" activePath="/customers">
      <MatrixPageHeader
        title="Add Customer"
        subtitle="Create an enterprise account for sites, assets, and contracts."
        breadcrumbs={["Matrix", "Customers", "Add"]}
        actions={
          <MatrixButton href="/customers" variant="secondary" size="md">
            Cancel
          </MatrixButton>
        }
      />

      <MatrixCard title="New account">
        <form onSubmit={submit} className="grid max-w-xl gap-4">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Customer name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Customer number</span>
            <input
              value={customerNumber}
              onChange={(e) => setCustomerNumber(e.target.value)}
              placeholder="Auto-generated if blank"
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Industry</span>
            <input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerStatus)}
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="PROSPECT">Prospect</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Primary address</span>
            <textarea
              value={primaryAddress}
              onChange={(e) => setPrimaryAddress(e.target.value)}
              rows={2}
              className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-white"
            />
          </label>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {createdId ? (
            <p className="text-sm text-cyan-300">Created — redirecting…</p>
          ) : null}
          <MatrixButton type="submit" variant="primary" size="md">
            Create customer
          </MatrixButton>
        </form>
      </MatrixCard>
    </MatrixShell>
  );
}
