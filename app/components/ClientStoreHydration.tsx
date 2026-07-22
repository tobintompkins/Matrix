"use client";

import { useEffect } from "react";
import { enableServiceCallBrowserPersistence } from "@/lib/service-calls";

/**
 * Enables sessionStorage-backed prototype stores after React hydration
 * so SSR and the first client paint stay in sync.
 */
export default function ClientStoreHydration() {
  useEffect(() => {
    enableServiceCallBrowserPersistence();
  }, []);
  return null;
}
