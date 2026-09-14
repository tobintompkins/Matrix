import { NextResponse } from "next/server";
import { evaluateFieldAccess, isFieldPage } from "./lib/field/access";
import { clerkMiddleware, createRouteMatcher, currentUser } from "@clerk/nextjs/server";

/**
 * Next.js 16+ uses proxy.ts (replaces middleware.ts).
 * Clerk does not protect routes by default — protect Matrix app routes explicitly.
 *
 * With no keys in .env.local, @clerk/nextjs keyless mode can provision
 * temporary development keys so Sign In / SSO can work locally.
 */

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/service-hub(.*)",
  "/inventory(.*)",
  "/scanner(.*)",
  "/parts(.*)",
  "/parts-order(.*)",
  "/parts-order-builder(.*)",
  "/parts-order-preview(.*)",
  "/order-parts(.*)",
  "/diagrams(.*)",
  "/diagram-library(.*)",
  "/diagram-part-detail(.*)",
  "/guided-diagram-ordering(.*)",
  "/digital-twin(.*)",
  "/printers(.*)",
  "/fleet(.*)",
  "/maintenance(.*)",
  "/notifications(.*)",
  "/customers(.*)",
  "/service-calls(.*)",
  "/dispatch(.*)",
  "/portal(.*)",
  "/admin(.*)",
  "/ai(.*)",
  "/ai-operations(.*)",
  "/work-orders(.*)",
  "/field(.*)",
  "/customers(.*)",
  "/add-customer(.*)",
  "/tickets(.*)",
  "/new-ticket(.*)",
  "/pm(.*)",
  "/start-pm(.*)",
  "/request-pm-kit(.*)",
  "/reports(.*)",
  "/admin(.*)",
  "/settings(.*)",
  "/knowledge-base(.*)",
  "/ai-technician(.*)",
  "/add-customer(.*)",
  "/register-printer(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return;
  }

  if (isProtectedRoute(request)) {
    await auth.protect();

    // Check every Field request, including direct nested URLs and client navigation.
    // This is an entry gate only; data handlers still require record-level checks.
    if (isFieldPage(request.nextUrl.pathname)) {
      try {
        const user = await currentUser();
        const access = evaluateFieldAccess(
          user?.id,
          user?.publicMetadata as Record<string, unknown> | undefined,
        );
        if (!access.allowed) {
          return new NextResponse(
            '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Matrix Field access</title></head><body><main style="max-width:40rem;margin:4rem auto;padding:1.5rem;font:1rem/1.6 system-ui"><h1>Field access is not available</h1><p>Ask your Matrix administrator to check your assigned role and Field access. No Field work has been opened.</p><a href="/dashboard">Return to Service Hub</a></main></body></html>',
            { status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } },
          );
        }
      } catch {
        // Identity lookup failure must never allow entry using a fallback role.
        return new NextResponse(
          "Matrix could not verify Field access. Please try again when your connection is available.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" } },
        );
      }
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
