import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
