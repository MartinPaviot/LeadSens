-- Add elevay_brand_profile table if it doesn't exist
CREATE TABLE IF NOT EXISTS "elevay_brand_profile" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "brand_name" TEXT NOT NULL,
  "brand_url" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "competitors" JSONB NOT NULL,
  "primary_keyword" TEXT NOT NULL,
  "secondary_keyword" TEXT NOT NULL,
  "sector" TEXT,
  "priority_channels" TEXT[],
  "objective" TEXT,
  "exportFormat" TEXT NOT NULL DEFAULT 'pdf',
  "report_recurrence" TEXT,
  "social_connections" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "elevay_brand_profile_pkey" PRIMARY KEY ("id")
);

-- Unique index on workspaceId
CREATE UNIQUE INDEX IF NOT EXISTS "elevay_brand_profile_workspaceId_key" ON "elevay_brand_profile"("workspaceId");

-- FK to workspace
DO $$ BEGIN
  ALTER TABLE "elevay_brand_profile"
    ADD CONSTRAINT "elevay_brand_profile_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add elevay_agent_run table if it doesn't exist
CREATE TABLE IF NOT EXISTS "elevay_agent_run" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "agentCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "output" JSONB NOT NULL,
  "degradedSources" TEXT[],
  "durationMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "brandProfileId" TEXT,

  CONSTRAINT "elevay_agent_run_pkey" PRIMARY KEY ("id")
);

-- Composite index
CREATE INDEX IF NOT EXISTS "elevay_agent_run_workspaceId_agentCode_createdAt_idx" ON "elevay_agent_run"("workspaceId", "agentCode", "createdAt");

-- FK to workspace
DO $$ BEGIN
  ALTER TABLE "elevay_agent_run"
    ADD CONSTRAINT "elevay_agent_run_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FK to brand profile
DO $$ BEGIN
  ALTER TABLE "elevay_agent_run"
    ADD CONSTRAINT "elevay_agent_run_brandProfileId_fkey"
    FOREIGN KEY ("brandProfileId") REFERENCES "elevay_brand_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
