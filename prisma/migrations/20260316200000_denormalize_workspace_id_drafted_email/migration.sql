-- Step 1: Add nullable workspaceId column
ALTER TABLE "drafted_email" ADD COLUMN "workspaceId" TEXT;

-- Step 2: Backfill from lead table
UPDATE "drafted_email" de
SET "workspaceId" = l."workspaceId"
FROM "lead" l
WHERE de."leadId" = l.id AND de."workspaceId" IS NULL;

-- Step 3: Set NOT NULL constraint
ALTER TABLE "drafted_email" ALTER COLUMN "workspaceId" SET NOT NULL;

-- Step 4: Add FK constraint
ALTER TABLE "drafted_email" ADD CONSTRAINT "drafted_email_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE;

-- Step 5: Add indexes for correlator queries
CREATE INDEX "drafted_email_workspaceId_signalType_idx" ON "drafted_email"("workspaceId", "signalType");
CREATE INDEX "drafted_email_workspaceId_step_ctaUsed_idx" ON "drafted_email"("workspaceId", step, "ctaUsed");
