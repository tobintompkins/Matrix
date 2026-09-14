"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    router.replace(userId ? "/dashboard" : "/sign-in");
  }, [isLoaded, userId, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--background)] px-4 text-[color:var(--foreground)]">
      <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">Matrix</p>
      <h1 className="mt-3 text-2xl font-semibold">Signing you in…</h1>
      <p className="mt-2 max-w-md text-center text-sm text-[color:var(--matrix-muted)]">
        Taking you to your workspace, or the sign-in page if you are not signed
        in yet.
      </p>
    </main>
  );
}
