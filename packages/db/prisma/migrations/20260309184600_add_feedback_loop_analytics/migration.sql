-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "analyticsCache" JSONB,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "drafted_email" ADD COLUMN     "bodyWordCount" INTEGER,
ADD COLUMN     "enrichmentDepth" TEXT,
ADD COLUMN     "frameworkName" TEXT,
ADD COLUMN     "leadIndustry" TEXT,
ADD COLUMN     "signalCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "signalType" TEXT;

-- CreateTable
CREATE TABLE "email_performance" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "bounced" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
    "interestStatus" INTEGER,
    "firstOpenAt" TIMESTAMP(3),
    "lastOpenAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "replyIsAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "replyAiInterest" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_analytics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "replied" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "openRate" DOUBLE PRECISION,
    "replyRate" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_performance_campaignId_idx" ON "email_performance"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "email_performance_leadId_campaignId_key" ON "email_performance"("leadId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "step_analytics_campaignId_step_key" ON "step_analytics"("campaignId", "step");

-- AddForeignKey
ALTER TABLE "email_performance" ADD CONSTRAINT "email_performance_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_performance" ADD CONSTRAINT "email_performance_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_analytics" ADD CONSTRAINT "step_analytics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
