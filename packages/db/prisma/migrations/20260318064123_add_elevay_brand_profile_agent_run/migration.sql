-- DropForeignKey
ALTER TABLE "drafted_email" DROP CONSTRAINT "drafted_email_workspaceId_fkey";

-- CreateTable
CREATE TABLE "elevay_brand_profile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "brand_url" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "competitors" JSONB NOT NULL,
    "primary_keyword" TEXT NOT NULL,
    "secondary_keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elevay_brand_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elevay_agent_run" (
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

-- CreateIndex
CREATE UNIQUE INDEX "elevay_brand_profile_workspaceId_key" ON "elevay_brand_profile"("workspaceId");

-- CreateIndex
CREATE INDEX "elevay_agent_run_workspaceId_agentCode_createdAt_idx" ON "elevay_agent_run"("workspaceId", "agentCode", "createdAt");

-- CreateIndex
CREATE INDEX "drafted_email_campaignId_leadId_idx" ON "drafted_email"("campaignId", "leadId");

-- CreateIndex
CREATE INDEX "drafted_email_campaignId_step_idx" ON "drafted_email"("campaignId", "step");

-- CreateIndex
CREATE INDEX "email_performance_campaignId_bounced_idx" ON "email_performance"("campaignId", "bounced");

-- CreateIndex
CREATE INDEX "email_performance_email_campaignId_idx" ON "email_performance"("email", "campaignId");

-- CreateIndex
CREATE INDEX "email_performance_campaignId_variantIndex_idx" ON "email_performance"("campaignId", "variantIndex");

-- CreateIndex
CREATE INDEX "lead_campaignId_workspaceId_status_idx" ON "lead"("campaignId", "workspaceId", "status");

-- AddForeignKey
ALTER TABLE "drafted_email" ADD CONSTRAINT "drafted_email_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elevay_brand_profile" ADD CONSTRAINT "elevay_brand_profile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elevay_agent_run" ADD CONSTRAINT "elevay_agent_run_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "elevay_brand_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elevay_agent_run" ADD CONSTRAINT "elevay_agent_run_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
