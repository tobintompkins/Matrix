"use client";

import Link from "next/link";
import {
  SignInButton,
  useAuth,
  useClerk,
  useUser,
} from "@clerk/nextjs";
import { useEffect, useId, useRef, useState } from "react";
import { resolveMatrixRole } from "@/lib/auth/permissions";
import type { MatrixRole } from "@/lib/auth/types";
import { revokeOfflineStoreForUser } from "@/lib/field/store";
import MatrixNotificationBell from "./MatrixNotificationBell";
import {
  IconSettings,
  IconSignOut,
  IconUser,
} from "./nav-icons";

function formatRole(role: MatrixRole): string {
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Compact header controls: notifications + profile menu.
 */
export default function MatrixAuthControls() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!authLoaded) {
    return (
      <div
        className="h-9 w-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900"
        aria-hidden
      />
    );
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
        <button
          type="button"
          className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          Sign In
        </button>
      </SignInButton>
    );
  }

  const displayName = userLoaded
    ? user?.fullName ||
      user?.primaryEmailAddress?.emailAddress ||
      "Matrix User"
    : "…";

  const initials =
    user?.firstName?.[0] ||
    user?.fullName?.[0] ||
    user?.primaryEmailAddress?.emailAddress?.[0] ||
    "M";

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      if (user?.id) await revokeOfflineStoreForUser(user.id);
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      setSignOutError("Could not clear offline Field data. Please try signing out again.");
      setSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <MatrixNotificationBell />

      <div className="relative" ref={rootRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 py-1 pl-1 pr-2.5 text-left transition hover:border-slate-600 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500/20 text-xs font-bold uppercase text-cyan-300">
            {initials}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[9rem] truncate text-xs font-medium text-slate-200">
              {displayName}
            </span>
            <span className="block truncate text-[10px] text-slate-500">
              {formatRole(role)}
            </span>
          </span>
        </button>

        {open && (
          <div
            id={menuId}
            role="menu"
            className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl shadow-black/40"
          >
            <div className="border-b border-slate-800 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white">
                {displayName}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{formatRole(role)}</p>
            </div>
            <div className="p-1.5">
              {signOutError && (
                <p className="mx-2 mb-2 rounded-md bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200" role="alert">
                  {signOutError}
                </p>
              )}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                onClick={() => {
                  setOpen(false);
                  openUserProfile();
                }}
              >
                <IconUser className="h-4 w-4 text-slate-500" />
                Account / Profile
              </button>
              <Link
                href="/notifications/preferences"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                onClick={() => setOpen(false)}
              >
                <IconSettings className="h-4 w-4 text-slate-500" />
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-300/90 transition hover:bg-rose-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                onClick={() => {
                  setOpen(false);
                  void handleSignOut();
                }}
              >
                <IconSignOut className="h-4 w-4" />
                {signingOut ? "Clearing Field data…" : "Sign out"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
