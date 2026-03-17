-- Rename Instantly-specific columns to ESP-generic names
-- Zero data loss: pure column renames

-- Lead table
ALTER TABLE "lead" RENAME COLUMN "instantlyLeadId" TO "espLeadId";
ALTER TABLE "lead" RENAME COLUMN "instantlyListId" TO "espListId";

-- Campaign table
ALTER TABLE "campaign" RENAME COLUMN "instantlyCampaignId" TO "espCampaignId";
ALTER TABLE "campaign" RENAME COLUMN "instantlyListId" TO "espListId";
ALTER TABLE "campaign" ADD COLUMN "espType" TEXT;

-- ReplyThread table
ALTER TABLE "reply_thread" RENAME COLUMN "instantlyThreadId" TO "espThreadId";

-- Reply table
ALTER TABLE "reply" RENAME COLUMN "instantlyEmailId" TO "espEmailId";
