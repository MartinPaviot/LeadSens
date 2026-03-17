-- Add sent tracking fields to EmailPerformance
ALTER TABLE "email_performance" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "email_performance" ADD COLUMN "sentStep" INTEGER;
