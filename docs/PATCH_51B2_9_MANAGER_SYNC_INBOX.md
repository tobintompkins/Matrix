# Patch 51B.2.9 — Manager Sync Inbox

Authorized Field managers can now open **Field Data → Review Server Sync Inbox** to see a safe summary of recently received Field operations. The inbox does not return operation payloads, notes, photos, signatures, or other sensitive field data.

The inbox shows the operation type, technician, work-order and printer reference, receipt time, and processing status. It is an operations review tool only. A `RECEIVED` receipt does not mean the server has applied the change to a work order yet.

Run `npm test` and `npm run lint` after applying.
