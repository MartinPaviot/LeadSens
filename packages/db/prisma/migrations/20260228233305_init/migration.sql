-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('INSTANTLY', 'HUBSPOT', 'SALESFORCE', 'GOOGLE_SHEETS');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'ERROR', 'EXPIRED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('SOURCED', 'SCORED', 'ENRICHED', 'DRAFTED', 'PUSHED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SOURCING', 'SCORING', 'ENRICHING', 'DRAFTING', 'READY', 'PUSHED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('GENERAL', 'COMPANY_CONTEXT', 'ICP_HISTORY', 'STYLE');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('THUMBS_UP', 'THUMBS_DOWN', 'USER_EDIT');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "companyUrl" TEXT,
    "companyDna" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "apiKey" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "accountEmail" TEXT,
    "accountName" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolInput" JSONB,
    "toolOutput" JSONB,
    "componentName" TEXT,
    "componentProps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "linkedinUrl" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "country" TEXT,
    "companySize" TEXT,
    "industry" TEXT,
    "instantlyLeadId" TEXT,
    "instantlyListId" TEXT,
    "enrichmentData" JSONB,
    "enrichedAt" TIMESTAMP(3),
    "icpScore" INTEGER,
    "icpBreakdown" JSONB,
    "campaignId" TEXT,
    "crmContactId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'SOURCED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "icpDescription" TEXT NOT NULL,
    "icpFilters" JSONB NOT NULL,
    "tone" TEXT,
    "stepsCount" INTEGER NOT NULL DEFAULT 3,
    "instantlyCampaignId" TEXT,
    "instantlyListId" TEXT,
    "leadsTotal" INTEGER NOT NULL DEFAULT 0,
    "leadsScored" INTEGER NOT NULL DEFAULT 0,
    "leadsEnriched" INTEGER NOT NULL DEFAULT 0,
    "leadsDrafted" INTEGER NOT NULL DEFAULT 0,
    "leadsPushed" INTEGER NOT NULL DEFAULT 0,
    "leadsSkipped" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafted_email" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensUsed" INTEGER,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "userEdit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drafted_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_memory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_feedback" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "originalOutput" TEXT NOT NULL,
    "userEdit" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_event" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mistral',
    "model" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_slug_key" ON "workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "integration_workspaceId_type_key" ON "integration"("workspaceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_campaignId_key" ON "conversation"("campaignId");

-- CreateIndex
CREATE INDEX "message_conversationId_createdAt_idx" ON "message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "lead_campaignId_status_idx" ON "lead"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lead_workspaceId_email_key" ON "lead"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "drafted_email_leadId_step_key" ON "drafted_email"("leadId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "agent_memory_workspaceId_key_key" ON "agent_memory"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "agent_feedback_workspaceId_createdAt_idx" ON "agent_feedback"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_event_workspaceId_createdAt_idx" ON "ai_event"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration" ADD CONSTRAINT "integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafted_email" ADD CONSTRAINT "drafted_email_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafted_email" ADD CONSTRAINT "drafted_email_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_event" ADD CONSTRAINT "ai_event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
