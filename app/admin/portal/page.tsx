"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminShell from "../../components/admin/AdminShell";
import MatrixAuthGuard from "../../components/MatrixAuthGuard";
import {
  MatrixButton,
  MatrixCard,
  MatrixStatCard,
} from "../../components/ui";
import {
  listAllMembershipsAdmin,
  listPortalAudit,
} from "@/lib/portal";
import { listCustomerStatusMappings } from "@/lib/portal/status-map";

type PortalSettings = {
  portalEnabled: boolean;
  allowCustomerServiceRequests: boolean;
  allowCustomerMeterSubmissions: boolean;
  allowCustomerPartsRequests: boolean;
  allowCustomerPmChangeRequests: boolean;
  allowCustomerUserInvitations: boolean;
  requireInternalApprovalForInvites: boolean;
  defaultPortalRole: string;
  maxAttachmentBytes: number;
  showTechnicianName: boolean;
  showScheduledWindow: boolean;
  supportContactName: string;
  supportPhone: string;
  supportEmail: string;
  termsUrl: string;
  privacyUrl: string;
};

export default function AdminPortalPage() {
  const [tick, setTick] = useState(0);
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const memberships = useMemo(() => {
    void tick;
    return listAllMembershipsAdmin();
  }, [tick]);
  const audit = useMemo(() => {
    void tick;
    return listPortalAudit(30);
  }, [tick]);
  const mappings = useMemo(() => listCustomerStatusMappings(), []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/portal/settings");
        const json = await res.json();
        if (json.ok && json.settings) setSettings(json.settings as PortalSettings);
      } catch {
        setSettingsNotice("Unable to load portal settings.");
      }
    })();
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setSettingsNotice("");
    try {
      const res = await fetch("/api/portal/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Save failed");
      if (json.settings) setSettings(json.settings as PortalSettings);
      setSettingsNotice("Portal settings saved.");
    } catch (e) {
      setSettingsNotice(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title="Customer portal administration"
      subtitle="Memberships, portal configuration, status labels, and portal audit (internal only)."
    >
      <MatrixAuthGuard requiredPermissions={["ADMINISTER_CUSTOMER_PORTAL"]}>
        <div className="mb-4 flex flex-wrap gap-2">
          <MatrixButton href="/portal/dashboard" variant="secondary" size="md">
            Preview portal (safe)
          </MatrixButton>
          <MatrixButton href="/portal/onboarding" variant="secondary" size="md">
            Preview onboarding
          </MatrixButton>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <MatrixStatCard label="Memberships" value={memberships.length} />
          <MatrixStatCard
            label="Active"
            value={memberships.filter((m) => m.status === "ACTIVE").length}
          />
          <MatrixStatCard
            label="Disabled"
            value={memberships.filter((m) => m.status === "DISABLED").length}
          />
        </div>

        <MatrixCard title="Portal settings" className="mb-6">
          {settingsNotice ? (
            <p className="mb-3 text-sm text-cyan-200" role="status">
              {settingsNotice}
            </p>
          ) : null}
          {!settings ? (
            <p className="text-sm text-slate-400">Loading settings…</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["portalEnabled", "Portal enabled"],
                  ["allowCustomerServiceRequests", "Allow service requests"],
                  ["allowCustomerMeterSubmissions", "Allow meter submissions"],
                  ["allowCustomerPartsRequests", "Allow parts requests"],
                  ["allowCustomerPmChangeRequests", "Allow PM change requests"],
                  ["allowCustomerUserInvitations", "Allow customer invitations"],
                  [
                    "requireInternalApprovalForInvites",
                    "Require internal approval for invites",
                  ],
                  ["showTechnicianName", "Show technician name to customers"],
                  ["showScheduledWindow", "Show scheduled window"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(settings[key])}
                    onChange={(e) =>
                      setSettings({ ...settings, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
              <label className="text-sm text-slate-300">
                Support contact
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  value={settings.supportContactName}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      supportContactName: e.target.value,
                    })
                  }
                />
              </label>
              <label className="text-sm text-slate-300">
                Support phone
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  value={settings.supportPhone}
                  onChange={(e) =>
                    setSettings({ ...settings, supportPhone: e.target.value })
                  }
                />
              </label>
              <label className="text-sm text-slate-300">
                Support email
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  value={settings.supportEmail}
                  onChange={(e) =>
                    setSettings({ ...settings, supportEmail: e.target.value })
                  }
                />
              </label>
              <label className="text-sm text-slate-300">
                Max attachment bytes
                <input
                  type="number"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  value={settings.maxAttachmentBytes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxAttachmentBytes: Number(e.target.value) || 0,
                    })
                  }
                />
              </label>
              <label className="text-sm text-slate-300">
                Terms URL
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  value={settings.termsUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, termsUrl: e.target.value })
                  }
                />
              </label>
              <label className="text-sm text-slate-300">
                Privacy URL
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                  value={settings.privacyUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, privacyUrl: e.target.value })
                  }
                />
              </label>
              <div className="sm:col-span-2">
                <MatrixButton
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={saving}
                  onClick={() => void saveSettings()}
                >
                  {saving ? "Saving…" : "Save portal settings"}
                </MatrixButton>
              </div>
            </div>
          )}
        </MatrixCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <MatrixCard title="Customer users">
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {memberships.map((m) => (
                <li key={m.id} className="border-b border-slate-800 pb-2">
                  {m.displayName} · {m.customerId} · {m.role} · {m.status}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-2 text-xs text-cyan-300"
              onClick={() => setTick((t) => t + 1)}
            >
              Refresh
            </button>
          </MatrixCard>

          <MatrixCard title="Customer status labels">
            <ul className="max-h-80 space-y-1 overflow-y-auto text-xs text-slate-300">
              {mappings.map((m) => (
                <li key={m.internal}>
                  {m.internal} → {m.customerCode} ({m.customer})
                </li>
              ))}
            </ul>
          </MatrixCard>

          <MatrixCard title="Portal audit" className="lg:col-span-2">
            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs text-slate-400">
              {audit.map((a) => (
                <li key={a.id}>
                  {a.occurredAt.slice(0, 19)} · {a.actor} · {a.action} ·{" "}
                  {a.entityId}
                </li>
              ))}
            </ul>
          </MatrixCard>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Preview opens the customer portal UI. Destructive impersonation
          actions are not enabled.
          <Link href="/portal/dashboard" className="ml-2 text-cyan-300">
            Open preview
          </Link>
        </p>
      </MatrixAuthGuard>
    </AdminShell>
  );
}
