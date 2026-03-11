-- AlterTable: Convert IntegrationType enum to plain String (TEXT)
-- This allows adding new integration types without migrations.

-- Step 1: Change column type from enum to TEXT (cast existing enum values)
ALTER TABLE "integration" ALTER COLUMN "type" SET DATA TYPE TEXT USING "type"::TEXT;

-- Step 2: Add metadata column for extensible connector config
ALTER TABLE "integration" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Step 3: Drop the enum type (no longer needed)
DROP TYPE IF EXISTS "IntegrationType";
