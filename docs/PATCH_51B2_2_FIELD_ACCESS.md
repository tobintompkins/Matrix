# 51B.2.2 — Field Access Checks
Delivery subdivision of roadmap item 51B.2 Mobile Technician Experience.
Status: applied in the Matrix workspace; runtime verification of live Clerk roles remains. 51B.2 remains in progress (not complete).

## Scope
The existing Clerk proxy protects signed-in routes. This patch additionally checks every /field request against the user's current Clerk publicMetadata.matrixRole and existing VIEW_FIELD permission.
Missing, invalid or inherited-property role names are denied. Field entry does not use the development SUPER_ADMIN fallback.
Forbidden users get a 403 page with a Service Hub link. Identity lookup failures return 503. Both responses disable caching.
Existing routes, UI, Field functionality and authentication on other routes are preserved.

## Before application
An authorized administrator must confirm intended Field users already have an explicitly assigned valid matrixRole in Clerk publicMetadata.
Do not give everyone ADMIN or SUPER_ADMIN to work around denial. FIELD_TECHNICIAN is the existing field role; preserve each user's intended role.
No user roles or credentials are changed by this patch.

## Boundaries
This gate does not replace authorization in API endpoints, Server Actions or data services.
It does not secure downloaded browser data, migrate the shared offline database, or remove fixed demo technician identities.
Previously cached/offline pages must not be assumed revoked by an online request gate.
Those remain separate 51B.2 gates. Do not claim multi-user or production readiness.

## Runtime acceptance
Verify signed-out access redirects to sign-in.
Verify configured technician access to /field and nested work/attachment pages.
Verify a customer role and missing/invalid roles get 403 on direct requests and client navigation.
Verify identity-service failure fails closed.
Recheck /dashboard, /portal and existing service workflows.
Check offline behavior and document the limits; no offline authorization guarantee is added here.

## Rollback
Reverse only this patch after a clean reverse check. Keep any newer work.
Reversal removes this added Field role gate; it does not change Clerk account roles or delete data.
