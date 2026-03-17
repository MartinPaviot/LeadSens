-- AlterTable
ALTER TABLE "workspace" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

-- Backfill: existing workspaces with companyDna = already onboarded
UPDATE "workspace" SET "onboardingCompletedAt" = "updatedAt" WHERE "companyDna" IS NOT NULL;
