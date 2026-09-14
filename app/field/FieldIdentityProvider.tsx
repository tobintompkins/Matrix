"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { resolveFieldIdentity, type FieldIdentity } from "@/lib/field/identity";
import { setOfflineStoreScope } from "@/lib/field/store";
const FieldIdentityContext = createContext<FieldIdentity | null>(null);
export function useFieldIdentity(): FieldIdentity {
  const identity = useContext(FieldIdentityContext);
  if (!identity) throw new Error("Field identity is required");
  return identity;
}
export default function FieldIdentityProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <p className="p-6" role="status">Checking your Field profile…</p>;
  const identity = resolveFieldIdentity(user);
  if (!identity) return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-semibold">Field profile needs attention</h1>
      <p className="mt-3">Sign in with an account that has Field access and a technician name. Ask your administrator to check your profile if this continues.</p>
      <Link className="mt-4 inline-block underline" href="/dashboard">Return to Service Hub</Link>
    </main>
  );
  // Scope storage before children mount. A different account receives a different database.
  setOfflineStoreScope(identity.userId);
  return (
    <FieldIdentityContext.Provider
      key={JSON.stringify([identity.userId, identity.technicianName, identity.role])}
      value={identity}
    >
      {children}
    </FieldIdentityContext.Provider>
  );
}
