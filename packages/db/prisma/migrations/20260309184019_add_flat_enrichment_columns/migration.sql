-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationType" ADD VALUE 'SMARTLEAD';
ALTER TYPE "IntegrationType" ADD VALUE 'LEMLIST';

-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "buyingSignals" TEXT,
ADD COLUMN     "careerHistory" TEXT,
ADD COLUMN     "companyDescription" TEXT,
ADD COLUMN     "companyOneLiner" TEXT,
ADD COLUMN     "companyPositioning" TEXT,
ADD COLUMN     "linkedinHeadline" TEXT,
ADD COLUMN     "painPointsFlat" TEXT,
ADD COLUMN     "productsFlat" TEXT,
ADD COLUMN     "recentPosts" TEXT,
ADD COLUMN     "targetCustomers" TEXT,
ADD COLUMN     "techStackFlat" TEXT,
ADD COLUMN     "valueProp" TEXT;
