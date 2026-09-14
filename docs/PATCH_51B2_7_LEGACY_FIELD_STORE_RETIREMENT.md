# Patch 51B.2.7 — Legacy Field store retirement

The original shared `matrix-field-offline-v1` browser database has no trustworthy signed-in owner. Matrix must never assign its contents to the next person who signs in.

This patch adds a confirmed **Remove Old Shared Field Data** action in Field Data settings. It removes only that obsolete shared database. It does not touch the current signed-in user's isolated Field cache. If another Matrix tab has the old database open, the action explains that the other tab must be closed first.

The existing current-user cleanup controls are now enabled because Field storage is isolated by Clerk user. Unsynchronized work still requires an explicit confirmation before it is removed.

Run `npm test` and `npm run lint` after applying.
