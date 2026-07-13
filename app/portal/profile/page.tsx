"use client";

import { useState } from "react";
import { MatrixButton, MatrixCard } from "../../components/ui";
import PortalShell from "../PortalShell";
import { getPortalProfile, updatePortalProfile } from "@/lib/portal";

export default function PortalProfilePage() {
  const profile = getPortalProfile();
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "");
  const [notice, setNotice] = useState("");

  if (!profile) {
    return (
      <PortalShell title="Profile">
        <p className="text-rose-300">No active membership.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell title="Profile & settings">
      {notice ? <p className="mb-3 text-sm text-cyan-200">{notice}</p> : null}
      <MatrixCard title={profile.displayName} subtitle={profile.email}>
        <p className="mb-3 text-xs text-slate-500">
          Organization and role cannot be changed here.
        </p>
        <div className="grid max-w-md gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-slate-400">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-slate-400">Job title</span>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            />
          </label>
          <p className="text-slate-400">Role: {profile.role}</p>
          <p className="text-slate-400">Time zone: {profile.timeZone}</p>
          <MatrixButton
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              const r = updatePortalProfile({ phone, jobTitle });
              setNotice(r.ok ? "Profile updated" : r.error ?? "Failed");
            }}
          >
            Save
          </MatrixButton>
        </div>
      </MatrixCard>
    </PortalShell>
  );
}
