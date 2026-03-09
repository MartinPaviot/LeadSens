-- CreateTable
CREATE TABLE "company_cache" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "markdown" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_cache_domain_key" ON "company_cache"("domain");
