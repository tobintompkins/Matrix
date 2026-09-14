# Patch 51B.2.10 — Server Field note processing

This patch adds the first real receipt processor. It applies received Field **NOTE** operations to an existing Prisma work order and marks the receipt `APPLIED`. A receipt whose work order is not yet in the server database stays `RECEIVED` for review; it is never silently discarded.

The processor is deliberately not connected to the technician button yet. It is a server-side foundation for the next controlled processing endpoint and prevents unsupported operation types from changing data.
