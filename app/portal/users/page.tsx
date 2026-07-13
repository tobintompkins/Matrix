"use client";

import { useMemo, useState } from "react";
import { MatrixButton, MatrixCard } from "../../components/ui";
import PortalShell from "../PortalShell";
import {
  createInvitation,
  disableMembership,
  getActiveMembership,
  listMembershipsForCustomer,
  listPendingInvitations,
} from "@/lib/portal";

export default function PortalUsersPage() {
  const me = getActiveMembership();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [tick, setTick] = useState(0);

  const users = useMemo(() => {
    void tick;
    return me ? listMembershipsForCustomer(me.customerId) : [];
  }, [me, tick]);

  const invites = useMemo(() => {
    void tick;
    return listPendingInvitations();
  }, [tick]);

  if (!me?.canManageUsers) {
    return (
      <PortalShell title="Users">
        <p className="text-slate-400">Only customer administrators can manage users.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell title="User management">
      {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}
      <MatrixCard title="Invite user" className="mb-6">
        <div className="grid max-w-md gap-2 text-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
          <MatrixButton
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              const r = createInvitation({
                email,
                displayName: name,
                role: "CUSTOMER_USER",
                locationIds: me.defaultLocationId ? [me.defaultLocationId] : [],
                printerIds: [],
                canApproveService: false,
                canViewMeters: true,
                canViewPm: true,
                canDownloadReports: true,
                canManageUsers: false,
              });
              setNotice(r.ok ? `Invited ${email}` : r.error ?? "Failed");
              setTick((t) => t + 1);
            }}
          >
            Send invitation
          </MatrixButton>
        </div>
      </MatrixCard>

      <MatrixCard title="Organization users" className="mb-6">
        <ul className="divide-y divide-slate-800 text-sm">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-white">
                  {u.displayName} · {u.role}
                </p>
                <p className="text-xs text-slate-500">
                  {u.email} · {u.status}
                </p>
              </div>
              {u.status === "ACTIVE" && u.id !== me.id ? (
                <MatrixButton
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    const r = disableMembership(u.id);
                    setNotice(r.ok ? "User disabled" : r.error ?? "Failed");
                    setTick((t) => t + 1);
                  }}
                >
                  Disable
                </MatrixButton>
              ) : null}
            </li>
          ))}
        </ul>
      </MatrixCard>

      <MatrixCard title="Pending invitations">
        <ul className="space-y-2 text-sm text-slate-300">
          {invites.map((i) => (
            <li key={i.id}>
              {i.email} · expires {i.expiresAt.slice(0, 10)}
            </li>
          ))}
          {invites.length === 0 ? <li>No pending invitations.</li> : null}
        </ul>
      </MatrixCard>
    </PortalShell>
  );
}
