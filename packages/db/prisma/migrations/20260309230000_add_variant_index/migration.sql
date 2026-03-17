-- AB-ATTR-01: Add variantIndex to EmailPerformance for A/B variant attribution
ALTER TABLE "email_performance" ADD COLUMN "variantIndex" INTEGER;
