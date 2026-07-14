import { redirect } from "next/navigation";

/**
 * Patch 47 — friendly Service Hub alias.
 * Reuses the existing /dashboard implementation (no duplicate page logic).
 */
export default function ServiceHubAliasPage() {
  redirect("/dashboard");
}
