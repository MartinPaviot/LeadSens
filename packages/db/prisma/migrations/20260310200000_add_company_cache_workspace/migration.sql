-- AlterTable: Add workspaceId to company_cache for workspace isolation
ALTER TABLE "company_cache" ADD COLUMN "workspaceId" TEXT;

-- AddForeignKey
ALTER TABLE "company_cache" ADD CONSTRAINT "company_cache_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "company_cache_domain_workspaceId_idx" ON "company_cache"("domain", "workspaceId");
