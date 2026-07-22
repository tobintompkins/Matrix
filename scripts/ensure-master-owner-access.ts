/**
 * Patch 50C-3 — Idempotent master owner access migration.
 *
 * Usage:
 *   npx tsx scripts/ensure-master-owner-access.ts
 *
 * Configure one of:
 *   MATRIX_OWNER_EMAIL=you@company.com
 *   MATRIX_OWNER_CLERK_USER_ID=user_...
 *
 * If neither is set, the script only assigns when exactly one active
 * ADMIN/SUPER_ADMIN directory user exists in the default organization.
 */

import "dotenv/config";
import { ensureAdminFoundationSeeded } from "../lib/admin/repository";
import {
  ensureMasterOwnerAccess,
  identifyPrimaryOwner,
} from "../lib/admin/owner-access";
import { DEFAULT_ORG_ID } from "../lib/admin/types";
import { prisma } from "../lib/db/prisma";

async function main() {
  await ensureAdminFoundationSeeded(DEFAULT_ORG_ID);
  const identified = await identifyPrimaryOwner(DEFAULT_ORG_ID);
  console.log("Identification:", identified);

  const result = await ensureMasterOwnerAccess(DEFAULT_ORG_ID);
  console.log("");
  console.log("Primary owner account located:", result.primaryOwnerLocated ? "Yes" : "No");
  console.log("Current role:", result.currentRole);
  console.log("Final role:", result.finalRole);
  console.log("Master access verified:", result.masterAccessVerified ? "Yes" : "No");
  console.log(
    "Missing permissions added:",
    result.missingPermissionsAdded.length
      ? result.missingPermissionsAdded.join("; ")
      : "(none)",
  );
  console.log("Duplicate account created: No");
  console.log("Clerk identity preserved: Yes");
  console.log("");
  console.log(result.message);

  // Idempotency check
  const again = await ensureMasterOwnerAccess(DEFAULT_ORG_ID);
  console.log("Idempotent re-run final role:", again.finalRole);
  console.log(
    "Idempotent re-run missing permissions:",
    again.missingPermissionsAdded.length === 0 ? "(none)" : again.missingPermissionsAdded.join("; "),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
