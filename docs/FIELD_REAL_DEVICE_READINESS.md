# Matrix Field — Real Device Readiness Checklist

Run this checklist on a signed-in Field account before production use.

Managers can record pass/fail results in **Field → Sync Inbox → Field Device Verification** (Patch 51B.2.12 local draft). Optionally **Submit finalized record** to store a durable manager-visible release record (Patch 51B.2.13). The **Field Release Readiness** card (Patch 51B.2.14) summarizes the latest submission; managers record audited **approve / hold / revoke** decisions (Patch 51B.2.15). See [PATCH_51B2_12_FIELD_DEVICE_VERIFICATION.md](./PATCH_51B2_12_FIELD_DEVICE_VERIFICATION.md), [PATCH_51B2_13_FIELD_DEVICE_VERIFICATION_SERVER.md](./PATCH_51B2_13_FIELD_DEVICE_VERIFICATION_SERVER.md), [PATCH_51B2_14_FIELD_RELEASE_READINESS.md](./PATCH_51B2_14_FIELD_RELEASE_READINESS.md), and [PATCH_51B2_15_FIELD_RELEASE_DECISION.md](./PATCH_51B2_15_FIELD_RELEASE_DECISION.md).

## Offline work

- Download an assigned work order.
- Close and reopen Matrix while offline; confirm the downloaded job opens.
- Add a note and change status while offline.
- Reconnect and use **Synchronize Now**.
- Confirm the Sync Inbox shows the received actions.

## Recovery

- Interrupt a sync by going offline, then reconnect and retry.
- Confirm no operation is duplicated.
- Confirm a conflicting status is left for review rather than silently overwritten.

## Evidence

- Add a photo and confirm its queue item remains visible until synchronized.
- Capture a signature or record a declined-signature reason.
- Complete a work order only after its required checklist items are satisfied.

## Shared-device safety

- Sign out and confirm the next user cannot see the prior user's Field cache.
- Confirm old shared Field data is removed only through the confirmed Field Data action.

## Phone, tablet, and laptop layout

- Laptop/computer: verify top navigation, two-column Today summary, and multi-column Assigned Work cards.
- Tablet: verify six bottom navigation actions and no overlap with the last page action.
- Phone: verify wrapped header, two-row bottom navigation, device safe-area spacing, and single-column work cards.
- Use keyboard Tab and the Skip to main content link on a computer.
- Verify visible active navigation and readable work filters without horizontal scrolling.
- Test empty Assigned Work results and Show all my work.
- Complete the offline, recovery, evidence, and shared-device checks above on signed-in real devices. Responsive layout changes do not mark those checks complete.
