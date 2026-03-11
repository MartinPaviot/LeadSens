-- AlterTable
ALTER TABLE "campaign" ADD COLUMN "broadenedFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
