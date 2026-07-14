"use client";

import { useEffect, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import { MatrixButton, MatrixCard } from "../../components/ui";

type Profile = {
  legalName: string | null;
  displayName: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  website: string | null;
  address: string | null;
  defaultTimeZone: string | null;
  dateFormat: string | null;
  timeFormat: string | null;
  defaultRegionId: string | null;
  defaultWarehouseId: string | null;
  businessHours: string | null;
};

export default function AdminOrganizationPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/organization", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Unable to load organization settings.");
        return;
      }
      setProfile(data.profile);
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setError("");
    const res = await fetch("/api/admin/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Unable to save organization settings.");
      return;
    }
    setProfile(data.profile);
    setNotice("Organization settings saved.");
  }

  return (
    <AdminShell
      title="Organization Settings"
      subtitle="Functional organization profile settings for the current tenant."
    >
      {error ? (
        <p className="mb-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-3 text-sm text-emerald-300" role="status">
          {notice}
        </p>
      ) : null}
      {!profile ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <MatrixCard title="Organization profile">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["legalName", "Legal name"],
                ["displayName", "Display name"],
                ["supportEmail", "Support email"],
                ["supportPhone", "Support phone"],
                ["website", "Website"],
                ["address", "Address"],
                ["defaultTimeZone", "Default time zone"],
                ["dateFormat", "Date format"],
                ["timeFormat", "Time format"],
                ["defaultRegionId", "Default region"],
                ["defaultWarehouseId", "Default warehouse"],
                ["businessHours", "Business hours"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm text-slate-400">
                {label}
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={profile[key] ?? ""}
                  onChange={(e) =>
                    setProfile({ ...profile, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div className="mt-4">
            <MatrixButton type="button" variant="primary" onClick={() => void save()}>
              Save organization settings
            </MatrixButton>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Branding foundation is limited to display name and contact fields in
            Patch 49A. Arbitrary CSS/theme injection is not supported.
          </p>
        </MatrixCard>
      )}
    </AdminShell>
  );
}
