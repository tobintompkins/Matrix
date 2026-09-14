# Patch 51B.2.6 — Sign-out offline revocation

When a user selects **Sign out**, Matrix clears that user's active Field offline cache before Clerk ends the session. This removes cached packages, attachments, queued actions, sessions, conflicts, and Field audit rows from the shared device.

If clearing cannot complete, Matrix keeps the user signed in and shows an error instead of leaving cached Field data available for the next user. Other users' isolated caches are never touched.

This patch does not remove the old `matrix-field-offline-v1` prototype database. That migration is the next separate roadmap item.

Run `npm test` and `npm run lint` after applying.
