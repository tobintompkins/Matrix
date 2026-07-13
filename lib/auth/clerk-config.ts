/**
 * Shared Clerk env detection for layout + proxy.
 * Real keys must be set in .env.local from https://dashboard.clerk.com
 * Placeholder / empty values keep Matrix bootable during setup.
 */
export function isClerkConfigured(): boolean {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";
  const secret = process.env.CLERK_SECRET_KEY?.trim() ?? "";

  if (!publishable || !secret) return false;
  if (publishable.includes("placeholder")) return false;
  if (secret.includes("placeholder")) return false;
  if (!publishable.startsWith("pk_")) return false;
  if (!secret.startsWith("sk_")) return false;

  return true;
}
