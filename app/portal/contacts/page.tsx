"use client";

import { useEffect, useState } from "react";
import PortalShell from "../PortalShell";
import { MatrixCard } from "../../components/ui";

type Contact = {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  source: string;
};

export default function PortalContactsPage() {
  const [customerName, setCustomerName] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/portal/contacts");
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Failed to load");
        setCustomerName(json.customerName ?? "");
        setContacts(json.contacts ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  return (
    <PortalShell title="Contacts">
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : (
        <MatrixCard title={customerName || "Service contacts"}>
          {contacts.length === 0 ? (
            <p className="text-sm text-slate-400">No contacts available.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {contacts.map((c) => (
                <li key={c.id} className="border-b border-slate-800 pb-2">
                  <p className="font-medium text-slate-100">
                    {c.name}
                    {c.isPrimary ? " · Primary" : ""}
                  </p>
                  <p className="text-slate-400">{c.role}</p>
                  <p className="text-slate-300">
                    {c.phone ?? "—"} · {c.email ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </MatrixCard>
      )}
    </PortalShell>
  );
}
