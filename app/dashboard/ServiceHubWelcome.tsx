"use client";

import { useUser } from "@clerk/nextjs";
import { resolveMatrixRole } from "@/lib/auth/permissions";
import {
  SERVICE_HUB_SUBTITLE,
  serviceHubWelcomeMessage,
} from "@/lib/service-hub/welcome";

function formatRoleLabel(role: string): string {
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/** Patch 47 — single Service Hub identity: subtitle + role-aware welcome (no second H1). */
export default function ServiceHubWelcome() {
  const { user } = useUser();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    null;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mb-6 space-y-3">
      <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
        {SERVICE_HUB_SUBTITLE}
      </p>
      <p className="max-w-3xl text-sm text-slate-200" role="status">
        {serviceHubWelcomeMessage(role)}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>{today}</span>
        {displayName ? (
          <span>
            Signed in as{" "}
            <span className="text-slate-300">{displayName}</span>
          </span>
        ) : null}
        <span>
          Role: <span className="text-slate-300">{formatRoleLabel(role)}</span>
        </span>
      </div>
    </div>
  );
}
