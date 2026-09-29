-- Patch 51B.2.13 — optional server record for finalized Field device verification.
CREATE TABLE IF NOT EXISTS "FieldDeviceVerificationSubmission" (
    "id" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByUserId" TEXT NOT NULL,
    "submittedByName" TEXT,
    "testerName" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "browserLabel" TEXT NOT NULL,
    "testDate" TEXT NOT NULL,
    "notes" TEXT,
    "releaseResult" TEXT NOT NULL,
    "passedCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "checksJson" TEXT NOT NULL,
    "localDraftUpdatedAt" TEXT,

    CONSTRAINT "FieldDeviceVerificationSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FieldDeviceVerificationSubmission_submittedAt_idx" ON "FieldDeviceVerificationSubmission"("submittedAt");
CREATE INDEX IF NOT EXISTS "FieldDeviceVerificationSubmission_submittedByUserId_idx" ON "FieldDeviceVerificationSubmission"("submittedByUserId");
