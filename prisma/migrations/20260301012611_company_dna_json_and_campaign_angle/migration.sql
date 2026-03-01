/*
  Warnings:

  - The `companyDna` column on the `workspace` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "angle" JSONB;

-- AlterTable
ALTER TABLE "workspace" DROP COLUMN "companyDna",
ADD COLUMN     "companyDna" JSONB;
