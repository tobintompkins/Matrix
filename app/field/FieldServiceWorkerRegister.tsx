"use client";

import { useEffect } from "react";

/** Registers Field PWA service worker when supported. */
export default function FieldServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal — Field still works as a normal web app
    });
  }, []);
  return null;
}
