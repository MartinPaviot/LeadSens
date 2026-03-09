-- AlterEnum: Add post-launch lead statuses
ALTER TYPE "LeadStatus" ADD VALUE 'SENT';
ALTER TYPE "LeadStatus" ADD VALUE 'REPLIED';
ALTER TYPE "LeadStatus" ADD VALUE 'INTERESTED';
ALTER TYPE "LeadStatus" ADD VALUE 'NOT_INTERESTED';
ALTER TYPE "LeadStatus" ADD VALUE 'MEETING_BOOKED';
ALTER TYPE "LeadStatus" ADD VALUE 'BOUNCED';
ALTER TYPE "LeadStatus" ADD VALUE 'UNSUBSCRIBED';

-- CreateEnum: ReplyThreadStatus
CREATE TYPE "ReplyThreadStatus" AS ENUM ('OPEN', 'INTERESTED', 'NOT_INTERESTED', 'MEETING_BOOKED', 'CLOSED');

-- CreateEnum: ReplyDirection
CREATE TYPE "ReplyDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable: reply_thread
CREATE TABLE "reply_thread" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "instantlyThreadId" TEXT,
    "subject" TEXT,
    "status" "ReplyThreadStatus" NOT NULL DEFAULT 'OPEN',
    "interestScore" DOUBLE PRECISION,
    "classifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reply_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable: reply
CREATE TABLE "reply" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "ReplyDirection" NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "preview" TEXT,
    "instantlyEmailId" TEXT,
    "isAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "aiInterest" DOUBLE PRECISION,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reply_thread_leadId_campaignId_key" ON "reply_thread"("leadId", "campaignId");
CREATE INDEX "reply_thread_workspaceId_status_idx" ON "reply_thread"("workspaceId", "status");
CREATE INDEX "reply_threadId_sentAt_idx" ON "reply"("threadId", "sentAt");

-- AddForeignKey
ALTER TABLE "reply_thread" ADD CONSTRAINT "reply_thread_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reply_thread" ADD CONSTRAINT "reply_thread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reply_thread" ADD CONSTRAINT "reply_thread_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reply" ADD CONSTRAINT "reply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "reply_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
